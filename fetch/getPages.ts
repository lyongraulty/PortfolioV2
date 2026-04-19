import "server-only";
import siteData from "../content/site-data.json";
import projectManifest from "../content/projects.json";

const PAGES_URL = process.env.GOOGLE_SCRIPT_URL?.trim() ?? "";
const CONTENT_SOURCE = process.env.CONTENT_SOURCE?.trim().toLowerCase() ?? "local";
const ENABLE_REMOTE_FALLBACK = (process.env.CONTENT_ENABLE_REMOTE_FALLBACK?.trim().toLowerCase() ?? "false") === "true";

export type PageRow = Record<string, unknown>;
type ProjectRow = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeRow(row: Record<string, unknown>): PageRow {
  const normalized: PageRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[sanitizeName(key)] = value as PageRow[string];
  }
  return normalized;
}

function parseRowsFromArray(items: unknown[]): PageRow[] {
  if (items.length === 0) {
    return [];
  }

  const first = items[0];
  if (isObject(first)) {
    return items.filter(isObject).map((row) => normalizeRow(row));
  }

  if (Array.isArray(first) && first.length > 0) {
    const headers = first.map((value) => sanitizeName(String(value)));
    return items
      .slice(1)
      .filter(Array.isArray)
      .map((row) => {
        const mapped: PageRow = {};
        headers.forEach((header, index) => {
          mapped[header] = row[index] as PageRow[string];
        });
        return mapped;
      });
  }

  return [];
}

function extractPages(data: unknown): PageRow[] {
  if (!isObject(data)) {
    return [];
  }

  const pages = data.pages;
  if (Array.isArray(pages)) {
    return parseRowsFromArray(pages);
  }

  return [];
}

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizePageId(value: unknown): string {
  const text = toText(value);
  if (!text) {
    return "";
  }
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    return String(Math.floor(numeric));
  }
  return text;
}

function inferMediaType(src: string): "video" | "image" {
  return /\.(mp4|webm|ogg|ogv|mov|m4v)(?:$|[?#])/i.test(src) ? "video" : "image";
}

function getLocalPages(): PageRow[] {
  const localEnvelope = siteData as Record<string, unknown>;
  const rawPagesFromLocal = extractPages(localEnvelope);

  const projectRows = (projectManifest as ProjectRow[]).filter(isObject);

  // Build slug → project lookup so site-data.json pages can be enriched
  // with fields that only live in projects.json (category, year, etc.)
  const projectBySlug = new Map<string, ProjectRow>();
  for (const project of projectRows) {
    const slug = toText(project.slug);
    if (slug) projectBySlug.set(slug, project);
  }

  const pagesFromLocal = rawPagesFromLocal.map((page) => {
    const slug = toText(page.slug);
    const project = slug ? projectBySlug.get(slug) : undefined;
    if (!project) return page;
    return {
      ...page,
      category: toText(page.category) || toText(project.category),
      year:     toText(page.year)     || toText(project.year),
    };
  });

  const pageIds = new Set(pagesFromLocal.map((page) => normalizePageId(page.page)).filter(Boolean));
  const derivedProjectPages: PageRow[] = projectRows.map((project, index) => {
    const slug = toText(project.slug);
    const pageId = String(index + 1);
    const title = toText(project.title) || "PROJECT";
    const copy = toText(project.summary) || toText(project.detail);
    const buttonText = "View Project";
    const media = isObject(project.media) ? project.media : null;
    const mediaSrc = media ? toText(media.src) : "";
    const mediaType = media ? toText(media.type).toLowerCase() : inferMediaType(mediaSrc);

    return {
      page: pageId,
      slug,
      title,
      year: toText(project.year),
      category: toText(project.category),
      button_text: buttonText,
      project_copy: copy,
      card_background: mediaSrc,
      blocks: mediaSrc
        ? [
            {
              id: "block01",
              index: 1,
              type: mediaType === "video" ? "video" : "image",
              layout: "single",
              title,
              copy,
              media: [{ role: mediaType, url: mediaSrc }],
            },
          ]
        : [],
    } satisfies PageRow;
  });

  const filteredDerived = derivedProjectPages.filter((page) => {
    const pageId = normalizePageId(page.page);
    if (!pageId || pageIds.has(pageId)) {
      return false;
    }
    pageIds.add(pageId);
    return true;
  });

  return [...pagesFromLocal, ...filteredDerived].sort((a, b) => {
    const left = Number(normalizePageId(a.page));
    const right = Number(normalizePageId(b.page));
    if (Number.isFinite(left) && Number.isFinite(right)) {
      return left - right;
    }
    return normalizePageId(a.page).localeCompare(normalizePageId(b.page));
  });
}

async function getRemotePages(): Promise<PageRow[]> {
  if (!PAGES_URL) {
    return [];
  }

  const response = await fetch(PAGES_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Google Script request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  return extractPages(data);
}

export async function getPages(): Promise<PageRow[]> {
  if (CONTENT_SOURCE === "remote") {
    const remotePages = await getRemotePages();
    if (remotePages.length > 0) {
      return remotePages;
    }
  }

  const localPages = getLocalPages();
  if (localPages.length > 0) {
    return localPages;
  }

  if (ENABLE_REMOTE_FALLBACK) {
    const remotePages = await getRemotePages();
    if (remotePages.length > 0) {
      return remotePages;
    }
  }

  return [];
}
