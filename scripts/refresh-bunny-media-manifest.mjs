import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const OUTPUT_FILE = path.join(ROOT, "content", "bunny-media.json");

const IMAGE_EXT_RE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const VIDEO_EXT_RE = /\.(m4v|mov|mp4|ogg|ogv|webm)$/i;

function trimSlashes(value) {
  return String(value ?? "").trim().replace(/^\/+|\/+$/g, "");
}

function parseList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseEnvText(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadConfig() {
  const fileEnv = parseEnvText(await fs.readFile(ENV_FILE, "utf8"));
  const env = { ...fileEnv, ...process.env };
  const zone = env.BUNNY_STORAGE_ZONE?.trim();
  const accessKey = env.BUNNY_STORAGE_API_KEY?.trim();
  const region = (env.BUNNY_STORAGE_REGION || "la").trim().toLowerCase();
  const host = (env.BUNNY_STORAGE_HOST || (region && region !== "de" ? `${region}.storage.bunnycdn.com` : "storage.bunnycdn.com")).trim();
  const mediaRoot = trimSlashes(env.BUNNY_MEDIA_ROOT || "projects");
  const storageMediaRoot = trimSlashes(env.BUNNY_STORAGE_MEDIA_ROOT || mediaRoot);
  const storageStripPrefix = trimSlashes(env.BUNNY_STORAGE_STRIP_PREFIX || "");

  if (!zone || !accessKey) {
    throw new Error("Missing BUNNY_STORAGE_ZONE or BUNNY_STORAGE_API_KEY in .env.local.");
  }

  return {
    zone,
    accessKey,
    host,
    mediaRoot,
    storageMediaRoot,
    storageStripPrefix,
    allowedSlugs: parseList(env.BUNNY_PROJECT_SLUGS),
    excludedSlugs: new Set(parseList(env.BUNNY_EXCLUDED_SLUGS)),
    projectOrder: parseList(env.BUNNY_PROJECT_ORDER),
  };
}

function bunnyPathUrl(config, remotePath) {
  const encodedPath = trimSlashes(remotePath)
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://${config.host}/${encodeURIComponent(config.zone)}/${encodedPath ? `${encodedPath}/` : ""}`;
}

async function listDirectory(config, remotePath) {
  const response = await fetch(bunnyPathUrl(config, remotePath), {
    headers: { AccessKey: config.accessKey },
  });

  if (!response.ok) {
    throw new Error(`Bunny Storage list failed for "${remotePath}": ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`Bunny Storage returned an unexpected response for "${remotePath}".`);
  }
  return data;
}

async function listMediaFiles(config, remotePath = config.mediaRoot) {
  const files = [];
  const items = await listDirectory(config, remotePath);

  for (const item of items) {
    const name = String(item.ObjectName ?? item.Name ?? "").trim();
    if (!name) continue;
    const childPath = `${trimSlashes(remotePath)}/${name}`.replace(/^\/+/g, "");
    const isDirectory = Boolean(item.IsDirectory) || item.Type === 0 || !path.extname(name);

    if (isDirectory) {
      files.push(...(await listMediaFiles(config, childPath)));
      continue;
    }

    if (IMAGE_EXT_RE.test(name) || VIDEO_EXT_RE.test(name)) {
      files.push(childPath.replace(/\\/g, "/"));
    }
  }

  return files;
}

async function collectMediaFiles(config) {
  let storageRoot = config.storageMediaRoot;
  let storageFiles = await listMediaFiles(config, storageRoot);

  if (storageFiles.length === 0 && storageRoot === config.mediaRoot) {
    const candidates = [`SYNC/media_live`, `SYNC/media_live/${config.mediaRoot}`, "UPLOADS"];
    for (const candidate of candidates) {
      const files = await listMediaFiles(config, candidate);
      if (files.length > 0) {
        storageRoot = candidate;
        storageFiles = files;
        break;
      }
    }
  }

  const stripPrefix =
    config.storageStripPrefix ||
    (storageRoot.endsWith(`/${config.mediaRoot}`) ? storageRoot.slice(0, -config.mediaRoot.length).replace(/\/+$/g, "") : "") ||
    (storageRoot !== config.mediaRoot ? storageRoot : "");

  return storageFiles
    .map((file) => {
      const normalized = trimSlashes(file);
      const prefix = trimSlashes(stripPrefix);
      return prefix && normalized.startsWith(`${prefix}/`) ? normalized.slice(prefix.length + 1) : normalized;
    })
    .filter((file) => file.startsWith(`${config.mediaRoot}/`) || !config.mediaRoot);
}

function projectSlugFromFile(file, mediaRoot) {
  const root = trimSlashes(mediaRoot);
  const parts = file.split("/").filter(Boolean);
  if (root) {
    const rootParts = root.split("/").filter(Boolean);
    const matchesRoot = rootParts.every((part, index) => parts[index] === part);
    if (matchesRoot) return parts[rootParts.length] ?? "";
  }
  return parts[1] ?? "";
}

function mediaType(src) {
  return VIDEO_EXT_RE.test(src) ? "video" : "image";
}

function chooseCard(files) {
  return (
    files.find((file) => /(?:^|[_\-\s])3x1(?:[_\-\s].*)?card|(?:^|[_\-\s])card(?:[_\-\s]|\.)/i.test(path.basename(file))) ??
    files.find((file) => /card/i.test(path.basename(file))) ??
    files[0] ??
    ""
  );
}

function sortProjectEntries(entries, projectOrder) {
  const order = new Map(projectOrder.map((slug, index) => [slug, index]));
  return entries.sort((a, b) => {
    const left = order.has(a.slug) ? order.get(a.slug) : Number.MAX_SAFE_INTEGER;
    const right = order.has(b.slug) ? order.get(b.slug) : Number.MAX_SAFE_INTEGER;
    return left - right || a.slug.localeCompare(b.slug);
  });
}

async function main() {
  const config = await loadConfig();

  if (process.argv.includes("--probe")) {
    const rootItems = await listDirectory(config, "");
    const mediaItems = await listDirectory(config, config.mediaRoot);
    const summarize = (items) =>
      items.map((item) => ({
        name: item.ObjectName ?? item.Name ?? "",
        isDirectory: Boolean(item.IsDirectory) || item.Type === 0,
      }));
    console.log(`Storage host: ${config.host}`);
    console.log(`Configured media root: ${config.mediaRoot || "/"}`);
    console.log(`Configured storage media root: ${config.storageMediaRoot || "/"}`);
    console.log("Root entries:");
    console.log(JSON.stringify(summarize(rootItems), null, 2));
    console.log("Media root entries:");
    console.log(JSON.stringify(summarize(mediaItems), null, 2));
    for (const item of rootItems) {
      const name = item.ObjectName ?? item.Name ?? "";
      const isDirectory = Boolean(item.IsDirectory) || item.Type === 0;
      if (!name || !isDirectory) continue;
      const childItems = await listDirectory(config, name);
      console.log(`${name} entries:`);
      console.log(JSON.stringify(summarize(childItems), null, 2));
    }
    return;
  }

  const allFiles = [...new Set(await collectMediaFiles(config))].sort((a, b) => a.localeCompare(b));
  const grouped = new Map();

  for (const file of allFiles) {
    const slug = projectSlugFromFile(file, config.mediaRoot);
    if (!slug || config.excludedSlugs.has(slug)) continue;
    if (config.allowedSlugs.length > 0 && !config.allowedSlugs.includes(slug)) continue;
    if (!grouped.has(slug)) grouped.set(slug, []);
    grouped.get(slug).push(file);
  }

  const generatedAt = new Date().toISOString();
  const entries = sortProjectEntries(
    [...grouped.entries()].map(([slug, files]) => {
      const card = chooseCard(files);
      return {
        slug,
        media: {
          card: card ? { type: mediaType(card), src: card } : undefined,
          blocks: [],
        },
        files,
        updated_at: generatedAt,
      };
    }),
    config.projectOrder,
  );

  if (entries.length === 0) {
    let previousEntries = [];
    try {
      previousEntries = JSON.parse(await fs.readFile(OUTPUT_FILE, "utf8"));
    } catch {
      previousEntries = [];
    }
    if (Array.isArray(previousEntries) && previousEntries.length > 0 && !process.argv.includes("--allow-empty")) {
      throw new Error(
        `Bunny manifest refresh found 0 projects under "${config.mediaRoot}" on ${config.host}. Refusing to overwrite existing non-empty manifest.`,
      );
    }
  }

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  console.log(`Refreshed content/bunny-media.json with ${entries.length} project${entries.length === 1 ? "" : "s"} and ${allFiles.length} media file${allFiles.length === 1 ? "" : "s"}.`);
}

await main();
