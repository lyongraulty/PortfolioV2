import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "content");
const WORKBOOK_DIR = path.join(CONTENT_DIR, "workbook");
const LOCAL_PROJECTS_MEDIA_DIR = path.join(ROOT, "public", "projects");

const SOURCE_SITE_DATA = path.join(CONTENT_DIR, "site-data.json");
const SOURCE_BUNNY_MEDIA = path.join(CONTENT_DIR, "bunny-media.json");
const PROJECTS_CSV = path.join(WORKBOOK_DIR, "Projects.csv");
const BLOCKS_CSV = path.join(WORKBOOK_DIR, "Blocks.csv");
const MEDIA_CSV = path.join(WORKBOOK_DIR, "Media.csv");
const CREDITS_CSV = path.join(WORKBOOK_DIR, "Credits.csv");
const SETTINGS_CSV = path.join(WORKBOOK_DIR, "Settings.csv");
const VARIABLES_CSV = path.join(WORKBOOK_DIR, "Variables.csv");
const FIELDS_CSV = path.join(WORKBOOK_DIR, "Fields.csv");

const PROJECT_HEADERS = [
  "page",
  "slug",
  "status",
  "title",
  "client",
  "studio",
  "year",
  "category",
  "template",
  "theme",
  "summary",
  "intro",
  "card_override",
  "hero_override",
  "featured",
  "sort_order",
];

const BLOCK_HEADERS = [
  "slug",
  "block_id",
  "order",
  "type",
  "layout",
  "variant",
  "tone",
  "eyebrow",
  "title",
  "copy",
  "caption",
  "caption_meta",
  "media_group",
  "credit_group",
  "link_group",
  "ticker_group",
  "spacing_before",
  "spacing_after",
  "section_height",
];

const MEDIA_HEADERS = [
  "slug",
  "media_group",
  "order",
  "purpose",
  "src",
  "detected_group",
  "detected_purpose",
  "label",
  "caption",
  "alt",
  "poster",
  "thumbnail_at",
  "aspect",
  "fit",
  "autoplay",
  "loop",
  "controls",
  "active",
  "notes",
];

const CREDITS_HEADERS = ["slug", "block_id", "order", "role", "name", "url"];
const TICKER_HEADERS = ["slug", "ticker_group", "order", "text"];
const LINKS_HEADERS = ["slug", "link_group", "order", "label", "url", "target"];
const SETTINGS_HEADERS = ["key", "value", "notes"];
const VARIABLES_HEADERS = ["category", "value", "label", "notes"];
const FIELDS_HEADERS = ["sheet", "field", "required", "allowed_category", "notes"];

const DEFAULT_VARIABLE_ROWS = [
  { category: "status", value: "live", label: "Live", notes: "Published and visible." },
  { category: "status", value: "draft", label: "Draft", notes: "Generated but not considered final." },
  { category: "status", value: "hidden", label: "Hidden", notes: "Excluded from generated project pages." },
  { category: "template", value: "signal", label: "Signal", notes: "Colossal-style technical/specimen page." },
  { category: "template", value: "editorial", label: "Editorial", notes: "Texas Monthly-style editorial page." },
  { category: "template", value: "case-study", label: "Case Study", notes: "Default flexible project page." },
  { category: "template", value: "gallery", label: "Gallery", notes: "Mostly visual project page." },
  { category: "template", value: "minimal", label: "Minimal", notes: "Sparse fallback page." },
  { category: "theme", value: "dark", label: "Dark", notes: "Default dark project shell." },
  { category: "theme", value: "light", label: "Light", notes: "Light project shell." },
  { category: "theme", value: "editorial", label: "Editorial", notes: "Paper/editorial treatment." },
  { category: "theme", value: "signal", label: "Signal", notes: "High-contrast technical treatment." },
  { category: "theme", value: "neutral", label: "Neutral", notes: "Minimal neutral treatment." },
  { category: "block_type", value: "intro", label: "Intro", notes: "Opening text/meta block." },
  { category: "block_type", value: "text", label: "Text", notes: "Copy-only block." },
  { category: "block_type", value: "media", label: "Media", notes: "General media block." },
  { category: "block_type", value: "image", label: "Image", notes: "Image-focused compatibility block." },
  { category: "block_type", value: "video", label: "Video", notes: "Video-focused compatibility block." },
  { category: "block_type", value: "video_embed", label: "Video Embed", notes: "Embedded or reel-style video block." },
  { category: "block_type", value: "gallery", label: "Gallery", notes: "Reusable media collection." },
  { category: "block_type", value: "feature", label: "Feature", notes: "Large media plus copy." },
  { category: "block_type", value: "process", label: "Process", notes: "Ordered process sequence." },
  { category: "block_type", value: "credits", label: "Credits", notes: "Credit list block." },
  { category: "block_type", value: "header", label: "Header", notes: "Page or section header block." },
  { category: "block_type", value: "divider", label: "Divider", notes: "Ticker or rhythm transition block." },
  { category: "block_type", value: "external-link", label: "External Link", notes: "Outbound link block." },
  { category: "layout", value: "single", label: "Single", notes: "One media/copy column." },
  { category: "layout", value: "two-up", label: "Two Up", notes: "Two equal media items." },
  { category: "layout", value: "three-up", label: "Three Up", notes: "Three equal media items." },
  { category: "layout", value: "grid", label: "Grid", notes: "Responsive media grid." },
  { category: "layout", value: "stack", label: "Stack", notes: "Vertical stack." },
  { category: "layout", value: "media-left", label: "Media Left", notes: "Media left, copy right." },
  { category: "layout", value: "media-right", label: "Media Right", notes: "Copy left, media right." },
  { category: "layout", value: "cover-grid", label: "Cover Grid", notes: "Editorial cover grid." },
  { category: "layout", value: "process-sequence", label: "Process Sequence", notes: "Ordered process layout." },
  { category: "layout", value: "filmstrip", label: "Filmstrip", notes: "Horizontal strip of media." },
  { category: "layout", value: "full-bleed", label: "Full Bleed", notes: "Viewport-scale media/header treatment." },
  { category: "spacing", value: "none", label: "None", notes: "No extra section pause." },
  { category: "spacing", value: "sm", label: "Small", notes: "Small section pause." },
  { category: "spacing", value: "md", label: "Medium", notes: "Default section pause." },
  { category: "spacing", value: "lg", label: "Large", notes: "Large section pause." },
  { category: "spacing", value: "xl", label: "XL", notes: "Extra-large section pause." },
  { category: "spacing", value: "cinematic", label: "Cinematic", notes: "Largest rhythm/pacing pause." },
  { category: "section_height", value: "auto", label: "Auto", notes: "Content decides height." },
  { category: "section_height", value: "compact", label: "Compact", notes: "Shorter section." },
  { category: "section_height", value: "standard", label: "Standard", notes: "Default section height." },
  { category: "section_height", value: "tall", label: "Tall", notes: "Large vertical section." },
  { category: "section_height", value: "full", label: "Full", notes: "Viewport-scale section." },
  { category: "tone", value: "default", label: "Default", notes: "Template default tone." },
  { category: "tone", value: "light", label: "Light", notes: "Light section tone." },
  { category: "tone", value: "dark", label: "Dark", notes: "Dark section tone." },
  { category: "tone", value: "paper", label: "Paper", notes: "Editorial paper tone." },
  { category: "tone", value: "signal", label: "Signal", notes: "Technical signal tone." },
  { category: "media_purpose", value: "card", label: "Card", notes: "Project list card media." },
  { category: "media_purpose", value: "hero", label: "Hero", notes: "Primary project hero media." },
  { category: "media_purpose", value: "poster", label: "Poster", notes: "Poster image for playable media." },
  { category: "media_purpose", value: "thumb", label: "Thumbnail", notes: "Small preview image." },
  { category: "media_purpose", value: "image", label: "Image", notes: "Generic image media." },
  { category: "media_purpose", value: "video", label: "Video", notes: "Generic video media." },
  { category: "media_purpose", value: "gallery_item", label: "Gallery Item", notes: "Item within a gallery group." },
  { category: "media_purpose", value: "process_step", label: "Process Step", notes: "Ordered process media." },
  { category: "media_purpose", value: "process_image", label: "Process Image", notes: "Process still/styleframe." },
  { category: "media_purpose", value: "cover", label: "Cover", notes: "Editorial cover media." },
  { category: "media_purpose", value: "fallback", label: "Fallback", notes: "Fallback media asset." },
  { category: "media_fit", value: "cover", label: "Cover", notes: "Crop to fill frame." },
  { category: "media_fit", value: "contain", label: "Contain", notes: "Preserve full media inside frame." },
  { category: "media_aspect", value: "auto", label: "Auto", notes: "Template decides aspect ratio." },
  { category: "media_aspect", value: "native", label: "Native", notes: "Use media native dimensions." },
  { category: "media_aspect", value: "16x9", label: "16:9", notes: "Landscape video frame." },
  { category: "media_aspect", value: "3x1", label: "3:1", notes: "Wide card/banner frame." },
  { category: "media_aspect", value: "4x5", label: "4:5", notes: "Portrait/social frame." },
  { category: "media_aspect", value: "1x1", label: "1:1", notes: "Square frame." },
  { category: "boolean", value: "true", label: "True", notes: "Enabled." },
  { category: "boolean", value: "false", label: "False", notes: "Disabled." },
];

const FIELD_ROWS = [
  { sheet: "Projects", field: "page", required: "true", allowed_category: "", notes: "Numeric page order." },
  { sheet: "Projects", field: "slug", required: "true", allowed_category: "", notes: "Stable project id, usually folder name." },
  { sheet: "Projects", field: "status", required: "true", allowed_category: "status", notes: "Use hidden to remove from generated output." },
  { sheet: "Projects", field: "title", required: "true", allowed_category: "", notes: "Public project title." },
  { sheet: "Projects", field: "client", required: "false", allowed_category: "", notes: "Client or project owner." },
  { sheet: "Projects", field: "studio", required: "false", allowed_category: "", notes: "Studio, agency, production company, or direct relationship." },
  { sheet: "Projects", field: "year", required: "false", allowed_category: "", notes: "Display year/range." },
  { sheet: "Projects", field: "category", required: "false", allowed_category: "", notes: "Display category." },
  { sheet: "Projects", field: "template", required: "true", allowed_category: "template", notes: "Controls project-page presentation template." },
  { sheet: "Projects", field: "theme", required: "false", allowed_category: "theme", notes: "Visual tone within template." },
  { sheet: "Projects", field: "summary", required: "false", allowed_category: "", notes: "Card and intro copy." },
  { sheet: "Projects", field: "intro", required: "false", allowed_category: "", notes: "Longer page intro if needed." },
  { sheet: "Projects", field: "card_override", required: "false", allowed_category: "", notes: "Explicit card media path. Overrides detection." },
  { sheet: "Projects", field: "hero_override", required: "false", allowed_category: "", notes: "Explicit hero media path. Overrides detection." },
  { sheet: "Projects", field: "featured", required: "false", allowed_category: "boolean", notes: "Use false for generated-but-not-featured projects." },
  { sheet: "Projects", field: "sort_order", required: "false", allowed_category: "", notes: "Manual sort override." },
  { sheet: "Blocks", field: "slug", required: "true", allowed_category: "", notes: "Project slug this block belongs to." },
  { sheet: "Blocks", field: "block_id", required: "true", allowed_category: "", notes: "Stable block id, e.g. intro, process-01." },
  { sheet: "Blocks", field: "order", required: "true", allowed_category: "", notes: "Block display order." },
  { sheet: "Blocks", field: "type", required: "true", allowed_category: "block_type", notes: "What the block is." },
  { sheet: "Blocks", field: "layout", required: "true", allowed_category: "layout", notes: "How the block arranges content." },
  { sheet: "Blocks", field: "variant", required: "false", allowed_category: "", notes: "Optional art-directed component variant." },
  { sheet: "Blocks", field: "tone", required: "false", allowed_category: "tone", notes: "Optional section tone." },
  { sheet: "Blocks", field: "eyebrow", required: "false", allowed_category: "", notes: "Small label above heading." },
  { sheet: "Blocks", field: "title", required: "false", allowed_category: "", notes: "Block heading." },
  { sheet: "Blocks", field: "copy", required: "false", allowed_category: "", notes: "Block body copy." },
  { sheet: "Blocks", field: "caption", required: "false", allowed_category: "", notes: "Block-level caption." },
  { sheet: "Blocks", field: "caption_meta", required: "false", allowed_category: "", notes: "Small metadata paired with a media caption." },
  { sheet: "Blocks", field: "media_group", required: "false", allowed_category: "", notes: "Matches Media.media_group." },
  { sheet: "Blocks", field: "credit_group", required: "false", allowed_category: "", notes: "Matches Credits.credit_group." },
  { sheet: "Blocks", field: "link_group", required: "false", allowed_category: "", notes: "Matches Links.link_group." },
  { sheet: "Blocks", field: "ticker_group", required: "false", allowed_category: "", notes: "Matches TickerItems.ticker_group." },
  { sheet: "Blocks", field: "spacing_before", required: "false", allowed_category: "spacing", notes: "Rhythm token before section." },
  { sheet: "Blocks", field: "spacing_after", required: "false", allowed_category: "spacing", notes: "Rhythm token after section." },
  { sheet: "Blocks", field: "section_height", required: "false", allowed_category: "section_height", notes: "Height token." },
  { sheet: "Media", field: "slug", required: "true", allowed_category: "", notes: "Project slug this media belongs to." },
  { sheet: "Media", field: "media_group", required: "true", allowed_category: "", notes: "Collection id used by Blocks.media_group." },
  { sheet: "Media", field: "order", required: "true", allowed_category: "", notes: "Media display order inside group." },
  { sheet: "Media", field: "purpose", required: "true", allowed_category: "media_purpose", notes: "Suggested dropdown values. Custom project-specific purposes like step_01 are allowed." },
  { sheet: "Media", field: "src", required: "true", allowed_category: "", notes: "Media path or URL." },
  { sheet: "Media", field: "detected_group", required: "false", allowed_category: "", notes: "Scanner hint. Safe to leave alone." },
  { sheet: "Media", field: "detected_purpose", required: "false", allowed_category: "", notes: "Scanner hint. Safe to leave alone." },
  { sheet: "Media", field: "label", required: "false", allowed_category: "", notes: "Visible media label, e.g. cover title." },
  { sheet: "Media", field: "caption", required: "false", allowed_category: "", notes: "Media caption." },
  { sheet: "Media", field: "alt", required: "false", allowed_category: "", notes: "Accessible image description." },
  { sheet: "Media", field: "poster", required: "false", allowed_category: "", notes: "Poster path for video/embed." },
  { sheet: "Media", field: "thumbnail_at", required: "false", allowed_category: "", notes: "Video thumbnail second." },
  { sheet: "Media", field: "aspect", required: "false", allowed_category: "media_aspect", notes: "Media aspect token." },
  { sheet: "Media", field: "fit", required: "false", allowed_category: "media_fit", notes: "Media object-fit behavior." },
  { sheet: "Media", field: "autoplay", required: "false", allowed_category: "boolean", notes: "Autoplay preference." },
  { sheet: "Media", field: "loop", required: "false", allowed_category: "boolean", notes: "Loop preference." },
  { sheet: "Media", field: "controls", required: "false", allowed_category: "boolean", notes: "Show controls preference." },
  { sheet: "Media", field: "active", required: "false", allowed_category: "boolean", notes: "False excludes the row." },
  { sheet: "Media", field: "notes", required: "false", allowed_category: "", notes: "Private editor note." },
  { sheet: "Credits", field: "slug", required: "true", allowed_category: "", notes: "Project slug." },
  { sheet: "Credits", field: "credit_group", required: "false", allowed_category: "", notes: "Named credit group, e.g. making-of." },
  { sheet: "Credits", field: "block_id", required: "false", allowed_category: "", notes: "Optional block-specific credit target." },
  { sheet: "Credits", field: "order", required: "true", allowed_category: "", notes: "Credit order." },
  { sheet: "Credits", field: "role", required: "true", allowed_category: "", notes: "Team role/title." },
  { sheet: "Credits", field: "name", required: "true", allowed_category: "", notes: "Person/company name." },
  { sheet: "Credits", field: "url", required: "false", allowed_category: "", notes: "Optional credit link." },
  { sheet: "TickerItems", field: "slug", required: "true", allowed_category: "", notes: "Project slug." },
  { sheet: "TickerItems", field: "ticker_group", required: "true", allowed_category: "", notes: "Named ticker group, e.g. main." },
  { sheet: "TickerItems", field: "order", required: "true", allowed_category: "", notes: "Ticker item order." },
  { sheet: "TickerItems", field: "text", required: "true", allowed_category: "", notes: "Ticker item text." },
  { sheet: "Links", field: "slug", required: "true", allowed_category: "", notes: "Project slug." },
  { sheet: "Links", field: "link_group", required: "true", allowed_category: "", notes: "Named link group." },
  { sheet: "Links", field: "order", required: "true", allowed_category: "", notes: "Link order." },
  { sheet: "Links", field: "label", required: "true", allowed_category: "", notes: "Visible link label." },
  { sheet: "Links", field: "url", required: "true", allowed_category: "", notes: "Link URL." },
  { sheet: "Links", field: "target", required: "false", allowed_category: "", notes: "Optional target, e.g. _blank." },
];

const IMAGE_EXT_RE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const VIDEO_EXT_RE = /\.(m4v|mov|mp4|ogg|ogv|webm)$/i;

function argSet() {
  return new Set(process.argv.slice(2));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function toText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  const numeric = Number(toText(value));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toBool(value, fallback = false) {
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(text);
}

function slugify(value) {
  return toText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeGroup(value) {
  return slugify(value).replace(/^gallery-([a-z])$/, "gallery-$1");
}

function normalizePurpose(value) {
  return slugify(value).replace(/-/g, "_");
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvParse(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.length > 0) || rows.length === 0) rows.push(row);
  return rows;
}

function csvStringify(headers, rows) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function readCsv(filePath) {
  if (!(await exists(filePath))) return [];
  const rows = csvParse(await fs.readFile(filePath, "utf8"));
  const headers = (rows.shift() ?? []).map((header) => slugify(header).replace(/-/g, "_"));
  return rows
    .filter((row) => row.some((cell) => toText(cell)))
    .map((row) => {
      const mapped = {};
      headers.forEach((header, index) => {
        mapped[header] = row[index] ?? "";
      });
      return mapped;
    });
}

async function writeCsv(filePath, headers, rows) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, csvStringify(headers, rows), "utf8");
}

function variableMap(rows = DEFAULT_VARIABLE_ROWS) {
  const map = new Map();
  for (const row of rows) {
    const category = toText(row.category);
    const value = toText(row.value);
    if (!category || !value) continue;
    if (!map.has(category)) map.set(category, new Set());
    map.get(category).add(value);
  }
  return map;
}

async function ensureHelperSheets({ overwrite = false } = {}) {
  if (overwrite || !(await exists(VARIABLES_CSV))) {
    await writeCsv(VARIABLES_CSV, VARIABLES_HEADERS, DEFAULT_VARIABLE_ROWS);
  }
  if (overwrite || !(await exists(FIELDS_CSV))) {
    await writeCsv(FIELDS_CSV, FIELDS_HEADERS, FIELD_ROWS);
  }
}

function sitePages(siteData) {
  return Array.isArray(siteData?.pages) ? siteData.pages.filter((page) => page && typeof page === "object") : [];
}

function inferTemplate(slug) {
  if (slug === "colossal") return "signal";
  if (slug === "texas-monthly") return "editorial";
  return "case-study";
}

function inferTheme(template) {
  if (template === "editorial") return "editorial";
  if (template === "signal") return "signal";
  return "dark";
}

export function collectBunnyFiles(bunnyMedia) {
  const files = new Set();
  const visit = (value) => {
    if (typeof value === "string") {
      if (value.startsWith("projects/") && (IMAGE_EXT_RE.test(value) || VIDEO_EXT_RE.test(value))) {
        files.add(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  visit(bunnyMedia);
  return [...files].sort((a, b) => a.localeCompare(b));
}

export async function collectLocalProjectFiles() {
  if (!(await exists(LOCAL_PROJECTS_MEDIA_DIR))) return [];
  const files = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = path.relative(path.join(ROOT, "public"), absolute).replace(/\\/g, "/");
      if (relative.startsWith("projects/") && (IMAGE_EXT_RE.test(relative) || VIDEO_EXT_RE.test(relative))) {
        files.push(relative);
      }
    }
  }

  await walk(LOCAL_PROJECTS_MEDIA_DIR);
  return files.sort((a, b) => a.localeCompare(b));
}

export async function collectDetectedFiles() {
  const bunnyMedia = await readJson(SOURCE_BUNNY_MEDIA, []);
  return [...new Set([...collectBunnyFiles(bunnyMedia), ...(await collectLocalProjectFiles())])].sort((a, b) =>
    a.localeCompare(b),
  );
}

function projectSlugFromSrc(src) {
  const parts = src.split(/[\\/]/).filter(Boolean);
  if (parts[0] !== "projects" || !parts[1]) return "";
  return parts[1];
}

function stripExtension(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

function detectOrder(text) {
  const stepRange = text.match(/step[^0-9]*([0-9]+)(?:[^0-9]+(?:and|-|to)[^0-9]+([0-9]+))?/i);
  if (stepRange) return Number(stepRange[1]);
  const trailing = text.match(/(?:^|[^0-9])([0-9]{1,3})(?:[^0-9]*)$/);
  return trailing ? Number(trailing[1]) : 1;
}

export function detectMedia(src) {
  const slug = projectSlugFromSrc(src);
  const filename = stripExtension(path.basename(src));
  const raw = filename.toLowerCase();
  const compact = raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const withoutSlug = compact.replace(new RegExp(`^${slugify(slug).replace(/-/g, "_")}_?`, "i"), "");
  const order = detectOrder(filename);

  let detectedGroup = "media";
  let detectedPurpose = IMAGE_EXT_RE.test(src) ? "image" : VIDEO_EXT_RE.test(src) ? "video" : "media";

  const galleryMatch = withoutSlug.match(/gallery_?([a-z0-9]+)?/i);
  if (galleryMatch) {
    detectedGroup = galleryMatch[1] ? `gallery-${galleryMatch[1]}` : "gallery";
    detectedPurpose = "gallery_item";
  } else if (/\b(card|3x1_card)\b|_card\b|card[0-9]*$/i.test(withoutSlug)) {
    detectedGroup = "card";
    detectedPurpose = "card";
  } else if (/hero|pageheader|header/i.test(withoutSlug)) {
    detectedGroup = "hero";
    detectedPurpose = "hero";
  } else if (/main_thumb|thumb|thumbnail/i.test(withoutSlug)) {
    detectedGroup = "thumb";
    detectedPurpose = "thumb";
  } else if (/poster/i.test(withoutSlug)) {
    detectedGroup = "poster";
    detectedPurpose = "poster";
  } else if (/fallback/i.test(withoutSlug)) {
    detectedGroup = "fallback";
    detectedPurpose = "fallback";
  } else if (/step|process|making.?of|cutdown/i.test(withoutSlug)) {
    detectedGroup = "process";
    detectedPurpose = "process_step";
  } else if (/cover|selena|apostle|water|body|fake/i.test(withoutSlug)) {
    detectedGroup = "covers";
    detectedPurpose = "cover";
  } else if (/still|album|board|styleframe|frame/i.test(withoutSlug)) {
    detectedGroup = "gallery";
    detectedPurpose = /board|styleframe/.test(withoutSlug) ? "process_image" : "gallery_item";
  }

  if (/step[^0-9]*([0-9]+)(?:[^0-9]+(?:and|-|to)[^0-9]+([0-9]+))?/i.test(filename)) {
    const match = filename.match(/step[^0-9]*([0-9]+)(?:[^0-9]+(?:and|-|to)[^0-9]+([0-9]+))?/i);
    const first = match?.[1]?.padStart(2, "0");
    const second = match?.[2]?.padStart(2, "0");
    detectedPurpose = second ? `step_${first}_${second}` : `step_${first}`;
  }

  return {
    slug,
    detected_group: normalizeGroup(detectedGroup),
    detected_purpose: normalizePurpose(detectedPurpose),
    order,
  };
}

function uniqueKey(row) {
  return `${toText(row.slug)}::${toText(row.src)}`;
}

function mediaType(src) {
  if (VIDEO_EXT_RE.test(src)) return "video";
  if (IMAGE_EXT_RE.test(src)) return "image";
  if (/youtube|vimeo/i.test(src)) return "embed";
  return "image";
}

export function rowByHeaders(headers, value = "") {
  return Object.fromEntries(headers.map((header) => [header, value]));
}

async function seedWorkbook() {
  const siteData = await readJson(SOURCE_SITE_DATA, {});
  const pages = sitePages(siteData);
  const files = await collectDetectedFiles();

  const projectRows = pages.map((page, index) => {
    const slug = slugify(page.slug || page.title || `project-${index + 1}`);
    const template = inferTemplate(slug);
    return {
      page: toText(page.page || index + 1),
      slug,
      status: "live",
      title: toText(page.title),
      client: toText(page.client || page.title),
      studio: toText(page.studio),
      year: toText(page.year),
      category: toText(page.category),
      template,
      theme: inferTheme(template),
      summary: toText(page.project_copy || page["project-copy"]),
      intro: toText(page.intro),
      card_override: toText(page.card_background || page["card-background"]),
      hero_override: "",
      featured: "true",
      sort_order: toText(page.page || index + 1),
    };
  });

  const blockRows = [];
  const mediaRows = [];
  const creditRows = [];

  for (const page of pages) {
    const slug = slugify(page.slug || page.title);
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    for (const [blockIndex, block] of blocks.entries()) {
      const blockId = toText(block.id) || `block-${String(blockIndex + 1).padStart(2, "0")}`;
      blockRows.push({
        slug,
        block_id: blockId,
        order: toText(block.index || blockIndex + 1),
        type: toText(block.type || "media"),
        layout: toText(block.layout || "single"),
        variant: "",
        tone: "",
        eyebrow: "",
        title: toText(block.title),
        copy: toText(block.copy || block.text || block.body || block.description),
        caption: "",
        media_group: blockId,
        spacing_before: "md",
        spacing_after: "md",
        section_height: "auto",
      });

      const media = Array.isArray(block.media) ? block.media : [];
      media.forEach((item, itemIndex) => {
        const src = toText(item.url || item.src);
        if (!src) return;
        const detected = detectMedia(src);
        mediaRows.push({
          slug,
          media_group: blockId,
          order: String(itemIndex + 1),
          purpose: normalizePurpose(item.purpose || item.role || detected.detected_purpose),
          src,
          detected_group: detected.detected_group,
          detected_purpose: detected.detected_purpose,
          caption: toText(item.caption),
          alt: toText(item.alt),
          poster: toText(item.poster || item.thumb),
          thumbnail_at: toText(item.thumbnail_at || item.thumbnailAt),
          aspect: "",
          fit: "",
          autoplay: "",
          loop: "",
          controls: "",
          active: "true",
          notes: "",
        });
      });
    }
  }

  const existingMedia = new Set(mediaRows.map(uniqueKey));
  for (const src of files) {
    const detected = detectMedia(src);
    if (!detected.slug || existingMedia.has(`${detected.slug}::${src}`)) continue;
    mediaRows.push({
      slug: detected.slug,
      media_group: detected.detected_group,
      order: String(detected.order),
      purpose: detected.detected_purpose,
      src,
      detected_group: detected.detected_group,
      detected_purpose: detected.detected_purpose,
      caption: "",
      alt: "",
      poster: "",
      thumbnail_at: "",
      aspect: "",
      fit: "",
      autoplay: "",
      loop: "",
      controls: "",
      active: "true",
      notes: "auto-detected",
    });
  }

  await writeCsv(PROJECTS_CSV, PROJECT_HEADERS, projectRows);
  await writeCsv(BLOCKS_CSV, BLOCK_HEADERS, blockRows);
  await writeCsv(MEDIA_CSV, MEDIA_HEADERS, mediaRows.sort(sortMediaRows));
  await writeCsv(CREDITS_CSV, CREDITS_HEADERS, creditRows);
  await writeCsv(SETTINGS_CSV, SETTINGS_HEADERS, [
    { key: "schema_version", value: "2", notes: "Generated project content schema version." },
    { key: "default_template", value: "case-study", notes: "Used when a project row has no template." },
    { key: "default_spacing", value: "md", notes: "Used when a block has no spacing token." },
  ]);
  await ensureHelperSheets({ overwrite: true });
}

export function sortMediaRows(a, b) {
  return (
    toText(a.slug).localeCompare(toText(b.slug)) ||
    toText(a.media_group).localeCompare(toText(b.media_group)) ||
    toNumber(a.order, 9999) - toNumber(b.order, 9999) ||
    toText(a.src).localeCompare(toText(b.src))
  );
}

async function syncMediaSheet() {
  const files = await collectDetectedFiles();
  const rows = await readCsv(MEDIA_CSV);
  const known = new Set(rows.map(uniqueKey));
  let added = 0;

  for (const src of files) {
    const detected = detectMedia(src);
    if (!detected.slug) continue;
    const key = `${detected.slug}::${src}`;
    if (known.has(key)) continue;
    rows.push({
      ...rowByHeaders(MEDIA_HEADERS),
      slug: detected.slug,
      media_group: detected.detected_group,
      order: String(detected.order),
      purpose: detected.detected_purpose,
      src,
      detected_group: detected.detected_group,
      detected_purpose: detected.detected_purpose,
      active: "true",
      notes: "auto-detected",
    });
    known.add(key);
    added += 1;
  }

  await writeCsv(MEDIA_CSV, MEDIA_HEADERS, rows.sort(sortMediaRows));
  return added;
}

function groupRows(rows, getKey) {
  const grouped = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function resolveProjectMedia(project, mediaRows, purpose, overrideField) {
  const override = toText(project[overrideField]);
  if (override) return override;
  const explicit = mediaRows.find((row) => normalizePurpose(row.purpose) === purpose);
  if (explicit) return toText(explicit.src);
  const detected = mediaRows.find((row) => normalizePurpose(row.detected_purpose) === purpose);
  if (detected) return toText(detected.src);
  if (purpose === "hero") {
    const header = mediaRows.find((row) => /hero|header|pageheader/.test(toText(row.src).toLowerCase()));
    if (header) return toText(header.src);
  }
  const first = mediaRows.find((row) => toBool(row.active, true) && toText(row.src));
  return first ? toText(first.src) : "";
}

function buildMediaRef(row) {
  const src = toText(row.src);
  return {
    purpose: normalizePurpose(row.purpose || row.detected_purpose || mediaType(src)),
    src,
    type: mediaType(src),
    alt: toText(row.alt) || undefined,
    caption: toText(row.caption) || undefined,
    label: toText(row.label) || undefined,
    poster: toText(row.poster) || undefined,
    thumbnailAt: toText(row.thumbnail_at) ? toNumber(row.thumbnail_at) : undefined,
    aspect: toText(row.aspect) || undefined,
    fit: toText(row.fit) || undefined,
    autoplay: toText(row.autoplay) ? toBool(row.autoplay) : undefined,
    loop: toText(row.loop) ? toBool(row.loop) : undefined,
    controls: toText(row.controls) ? toBool(row.controls) : undefined,
  };
}

function compactObject(value) {
  if (Array.isArray(value)) return value.map(compactObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined && entry !== "")
      .map(([key, entry]) => [key, compactObject(entry)]),
  );
}

function validateAllowedValues({ projectRows, blockRows, mediaRows, variableRows }) {
  const variables = variableMap(variableRows);
  const warnings = [];

  const check = (sheet, rows, checks) => {
    rows.forEach((row, index) => {
      for (const { field, category, normalize = (value) => toText(value) } of checks) {
        const value = normalize(row[field]);
        if (!value) continue;
        const allowed = variables.get(category);
        if (!allowed || allowed.has(value)) continue;
        warnings.push({
          level: "warning",
          sheet,
          row: index + 2,
          field,
          value,
          message: `Unknown ${field} value. Expected one of: ${[...allowed].join(", ")}.`,
        });
      }
    });
  };

  check("Projects", projectRows, [
    { field: "status", category: "status", normalize: (value) => toText(value).toLowerCase() },
    { field: "template", category: "template", normalize: (value) => toText(value).toLowerCase() },
    { field: "theme", category: "theme", normalize: (value) => toText(value).toLowerCase() },
    { field: "featured", category: "boolean", normalize: (value) => toText(value).toLowerCase() },
  ]);

  check("Blocks", blockRows, [
    { field: "type", category: "block_type", normalize: (value) => toText(value).toLowerCase() },
    { field: "layout", category: "layout", normalize: (value) => toText(value).toLowerCase() },
    { field: "tone", category: "tone", normalize: (value) => toText(value).toLowerCase() },
    { field: "spacing_before", category: "spacing", normalize: (value) => toText(value).toLowerCase() },
    { field: "spacing_after", category: "spacing", normalize: (value) => toText(value).toLowerCase() },
    { field: "section_height", category: "section_height", normalize: (value) => toText(value).toLowerCase() },
  ]);

  check("Media", mediaRows, [
    { field: "aspect", category: "media_aspect", normalize: (value) => toText(value).toLowerCase() },
    { field: "fit", category: "media_fit", normalize: (value) => toText(value).toLowerCase() },
    { field: "autoplay", category: "boolean", normalize: (value) => toText(value).toLowerCase() },
    { field: "loop", category: "boolean", normalize: (value) => toText(value).toLowerCase() },
    { field: "controls", category: "boolean", normalize: (value) => toText(value).toLowerCase() },
    { field: "active", category: "boolean", normalize: (value) => toText(value).toLowerCase() },
  ]);

  return warnings;
}

function legacyMedia(mediaRef) {
  return compactObject({
    role: mediaRef.purpose,
    url: mediaRef.src,
    thumbnail_at: mediaRef.thumbnailAt,
    caption: mediaRef.caption,
    label: mediaRef.label,
    alt: mediaRef.alt,
    poster: mediaRef.poster,
  });
}

export async function buildGeneratedContentFromRows({
  sourceSiteData,
  projectRows,
  blockRows,
  mediaRows,
  creditRows,
  tickerRows = [],
  linkRows = [],
  variableRows,
  source = "local-workbook",
}) {
  const activeMediaRows = mediaRows.filter((row) => toBool(row.active, true));
  const mediaBySlug = groupRows(activeMediaRows, (row) => toText(row.slug));
  const blocksBySlug = groupRows(blockRows, (row) => toText(row.slug));
  const creditsBySlug = groupRows(creditRows, (row) => toText(row.slug));
  const creditsByBlock = groupRows(creditRows, (row) => `${toText(row.slug)}::${toText(row.block_id)}`);
  const creditsByGroup = groupRows(creditRows, (row) => `${toText(row.slug)}::${toText(row.credit_group)}`);
  const tickersBySlug = groupRows(tickerRows, (row) => toText(row.slug));
  const linksByGroup = groupRows(linkRows, (row) => `${toText(row.slug)}::${toText(row.link_group)}`);
  const warnings = validateAllowedValues({ projectRows, blockRows, mediaRows: activeMediaRows, variableRows });

  const projects = projectRows
    .filter((project) => toText(project.slug) && toText(project.status).toLowerCase() !== "hidden")
    .sort((a, b) => toNumber(a.sort_order || a.page, 9999) - toNumber(b.sort_order || b.page, 9999))
    .map((project) => {
      const slug = toText(project.slug);
      const projectMedia = mediaBySlug.get(slug) ?? [];
      const cardSrc = resolveProjectMedia(project, projectMedia, "card", "card_override");
      const heroSrc = resolveProjectMedia(project, projectMedia, "hero", "hero_override") || cardSrc;
      if (!cardSrc) warnings.push({ level: "warning", slug, message: "No card media resolved." });

      const blocks = (blocksBySlug.get(slug) ?? [])
        .sort((a, b) => toNumber(a.order, 9999) - toNumber(b.order, 9999))
        .map((block, index) => {
          const blockId = toText(block.block_id) || `block-${String(index + 1).padStart(2, "0")}`;
          const mediaGroup = normalizeGroup(block.media_group || blockId);
          const blockMedia = projectMedia
            .filter((row) => normalizeGroup(row.media_group) === mediaGroup)
            .sort(sortMediaRows)
            .map(buildMediaRef)
            .filter((media) => media.src);
          const credits = (creditsByBlock.get(`${slug}::${blockId}`) ?? [])
            .sort((a, b) => toNumber(a.order, 9999) - toNumber(b.order, 9999))
            .map((credit) => compactObject({ role: toText(credit.role), name: toText(credit.name), url: toText(credit.url) }));

          return compactObject({
            id: blockId,
            order: toNumber(block.order, index + 1),
            type: toText(block.type) || "media",
            layout: toText(block.layout) || "single",
            variant: toText(block.variant),
            tone: toText(block.tone),
            eyebrow: toText(block.eyebrow),
            title: toText(block.title),
            copy: toText(block.copy),
            caption: toText(block.caption),
            captionMeta: toText(block.caption_meta),
            mediaGroup,
            creditGroup: toText(block.credit_group),
            linkGroup: toText(block.link_group),
            tickerGroup: toText(block.ticker_group),
            spacingBefore: toText(block.spacing_before) || "md",
            spacingAfter: toText(block.spacing_after) || "md",
            sectionHeight: toText(block.section_height) || "auto",
            media: blockMedia,
            credits,
          });
        });

      const projectCredits = (creditsBySlug.get(slug) ?? [])
        .filter((credit) => !toText(credit.block_id) && !toText(credit.credit_group))
        .sort((a, b) => toNumber(a.order, 9999) - toNumber(b.order, 9999))
        .map((credit) => compactObject({ role: toText(credit.role), name: toText(credit.name), url: toText(credit.url) }));
      const creditGroups = Object.fromEntries(
        [...new Set((creditsBySlug.get(slug) ?? []).map((credit) => toText(credit.credit_group)).filter(Boolean))]
          .map((group) => [
            group,
            (creditsByGroup.get(`${slug}::${group}`) ?? [])
              .sort((a, b) => toNumber(a.order, 9999) - toNumber(b.order, 9999))
              .map((credit) => compactObject({ role: toText(credit.role), name: toText(credit.name), url: toText(credit.url) })),
          ]),
      );
      const tickerGroups = Object.fromEntries(
        [...new Set((tickersBySlug.get(slug) ?? []).map((item) => toText(item.ticker_group)).filter(Boolean))]
          .map((group) => [
            group,
            (tickersBySlug.get(slug) ?? [])
              .filter((item) => toText(item.ticker_group) === group)
              .sort((a, b) => toNumber(a.order, 9999) - toNumber(b.order, 9999))
              .map((item) => toText(item.text))
              .filter(Boolean),
          ]),
      );
      const linkGroups = Object.fromEntries(
        [...new Set(linkRows.filter((link) => toText(link.slug) === slug).map((link) => toText(link.link_group)).filter(Boolean))]
          .map((group) => [
            group,
            (linksByGroup.get(`${slug}::${group}`) ?? [])
              .sort((a, b) => toNumber(a.order, 9999) - toNumber(b.order, 9999))
              .map((link) => compactObject({ label: toText(link.label), url: toText(link.url), target: toText(link.target) })),
          ]),
      );

      return compactObject({
        page: toNumber(project.page),
        slug,
        status: toText(project.status) || "draft",
        title: toText(project.title),
        client: toText(project.client),
        studio: toText(project.studio),
        year: toText(project.year),
        category: toText(project.category),
        template: toText(project.template) || "case-study",
        theme: toText(project.theme),
        featured: toBool(project.featured, true),
        sortOrder: toNumber(project.sort_order || project.page),
        summary: toText(project.summary),
        intro: toText(project.intro),
        card: cardSrc ? { purpose: "card", src: cardSrc, type: mediaType(cardSrc) } : undefined,
        hero: heroSrc ? { purpose: "hero", src: heroSrc, type: mediaType(heroSrc) } : undefined,
        blocks,
        credits: projectCredits,
        creditGroups,
        tickerGroups,
        linkGroups,
      });
    });

  const legacyPages = projects.map((project) => ({
    page: String(project.page),
    slug: project.slug,
    title: project.title,
    client: project.client,
    studio: project.studio,
    year: project.year,
    category: project.category,
    template: project.template,
    theme: project.theme,
    status: project.status,
    button_text: "View Project",
    project_copy: project.summary ?? project.intro ?? "",
    card_background: project.card?.src ?? "",
    hero_background: project.hero?.src ?? "",
    blocks: (project.blocks ?? []).map((block) =>
      compactObject({
        id: block.id,
        index: block.order,
        type: block.type,
        layout: block.layout,
        variant: block.variant,
        tone: block.tone,
        eyebrow: block.eyebrow,
        title: block.title,
        copy: block.copy,
        caption: block.caption,
        caption_meta: block.captionMeta,
        spacing_before: block.spacingBefore,
        spacing_after: block.spacingAfter,
        section_height: block.sectionHeight,
        media: (block.media ?? []).map(legacyMedia),
        credits: block.credits,
      }),
    ),
    credits: project.credits,
    credit_groups: project.creditGroups,
    ticker_groups: project.tickerGroups,
    link_groups: project.linkGroups,
  }));

  const generatedAt = new Date().toISOString();
  const projectContent = {
    schema_version: 2,
    source,
    generated_at: generatedAt,
    projects,
  };

  const legacySiteData = {
    ...sourceSiteData,
    schema_version: 2,
    source,
    generated_at: generatedAt,
    pages: legacyPages,
  };

  await fs.writeFile(path.join(CONTENT_DIR, "project-content.json"), `${JSON.stringify(projectContent, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(CONTENT_DIR, "site-data.json"), `${JSON.stringify(legacySiteData, null, 2)}\n`, "utf8");
  await fs.writeFile(
    path.join(CONTENT_DIR, "archive", "content-errors.json"),
    `${JSON.stringify({ generated_at: generatedAt, warnings }, null, 2)}\n`,
    "utf8",
  );

  return { projects: projects.length, warnings: warnings.length };
}

async function buildGeneratedContent() {
  await ensureHelperSheets();
  return buildGeneratedContentFromRows({
    sourceSiteData: await readJson(SOURCE_SITE_DATA, {}),
    projectRows: await readCsv(PROJECTS_CSV),
    blockRows: await readCsv(BLOCKS_CSV),
    mediaRows: await readCsv(MEDIA_CSV),
    creditRows: await readCsv(CREDITS_CSV),
    tickerRows: [],
    linkRows: [],
    variableRows: await readCsv(VARIABLES_CSV),
  });
}

async function main() {
  const args = argSet();
  await fs.mkdir(WORKBOOK_DIR, { recursive: true });

  if (args.has("--init") || !(await exists(PROJECTS_CSV))) {
    await seedWorkbook();
    console.log(`Seeded workbook CSV sheets in ${path.relative(ROOT, WORKBOOK_DIR)}`);
  }

  if (args.has("--sync-media")) {
    const added = await syncMediaSheet();
    console.log(`Media sync complete. Added ${added} row${added === 1 ? "" : "s"}.`);
  }

  const result = await buildGeneratedContent();
  console.log(`Generated ${result.projects} project page${result.projects === 1 ? "" : "s"} with ${result.warnings} warning${result.warnings === 1 ? "" : "s"}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
