import "server-only";
import siteData from "../content/site-data.json";

const TOKENS_URL = process.env.GOOGLE_SCRIPT_URL?.trim() ?? "";
const CONTENT_SOURCE = process.env.CONTENT_SOURCE?.trim().toLowerCase() ?? "local";
const ENABLE_REMOTE_FALLBACK = (process.env.CONTENT_ENABLE_REMOTE_FALLBACK?.trim().toLowerCase() ?? "false") === "true";

export type TokenMap = Record<string, string | number>;
type TokenRow = Record<string, unknown>;
type JsonObject = Record<string, unknown>;

const SCHEMA_COLUMNS = new Set([
  "token",
  "font",
  "weight",
  "size-px",
  "style",
  "letter-spacing",
  "line-height",
  "text-transform",
  "color-light",
  "color-dark",
  "size-min-px",
  "size-max-px",
  "size-fluid-vw",
]);

const PX_COLUMNS = new Set(["size-px", "size-min-px", "size-max-px"]);

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeRow(row: TokenRow): TokenRow {
  const normalized: TokenRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[sanitizeName(key)] = value;
  }
  return normalized;
}

function normalizeValue(column: string, value: unknown): string | number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) {
    if (column === "size-fluid-vw") {
      return `${numeric}vw`;
    }
    if (PX_COLUMNS.has(column)) {
      return `${numeric}px`;
    }
    return raw;
  }

  return raw;
}

function parseRowsFromArray(items: unknown[]): TokenRow[] {
  if (items.length === 0) {
    return [];
  }

  const first = items[0];
  if (isObject(first) && Object.keys(first).some((key) => sanitizeName(key) === "token")) {
    return items.filter(isObject) as TokenRow[];
  }

  if (Array.isArray(first) && first.length > 0) {
    const headers = first.map((value) => sanitizeName(String(value)));
    if (!headers.includes("token")) {
      return [];
    }

    return items
      .slice(1)
      .filter(Array.isArray)
      .map((row) => {
        const mapped: TokenRow = {};
        headers.forEach((header, index) => {
          mapped[header] = row[index];
        });
        return mapped;
      });
  }

  return [];
}

function extractTokenRows(data: unknown): TokenRow[] {
  if (Array.isArray(data)) {
    return parseRowsFromArray(data);
  }

  if (!isObject(data)) {
    return [];
  }

  const rowKeys = new Set(["rows", "data", "values", "tokens", "type-tokens", "typetokens"]);
  for (const [rawKey, candidate] of Object.entries(data)) {
    const key = sanitizeName(rawKey);
    if (!rowKeys.has(key)) {
      continue;
    }
    if (Array.isArray(candidate)) {
      const parsed = parseRowsFromArray(candidate);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  }

  if (Array.isArray(data.columns) && Array.isArray(data.rows)) {
    const columns = data.columns.map((column) => sanitizeName(String(column)));
    if (columns.includes("token")) {
      return data.rows
        .filter(Array.isArray)
        .map((row) => {
          const mapped: TokenRow = {};
          columns.forEach((column, index) => {
            mapped[column] = row[index];
          });
          return mapped;
        });
    }
  }

  return [];
}

function extractSchemaEnvelope(data: unknown): JsonObject | null {
  if (!isObject(data)) {
    return null;
  }

  const hasSchemaVersion = typeof data.schema_version === "number" || typeof data.schema_version === "string";
  const hasTypeTokens = Array.isArray(data["type-tokens"]);

  if (hasSchemaVersion && hasTypeTokens) {
    return data;
  }

  return null;
}

function toFlatTokenMap(data: JsonObject): TokenMap {
  const tokens: TokenMap = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" || typeof value === "number") {
      tokens[key] = value;
    }
  }

  return tokens;
}

function applyLegacyAliases(tokens: TokenMap, rowKey: string, row: TokenRow): void {
  const font = normalizeValue("font", row["font"]);
  const size = normalizeValue("size-px", row["size-px"]);
  const sizeMin = normalizeValue("size-min-px", row["size-min-px"]);
  const sizeMax = normalizeValue("size-max-px", row["size-max-px"]);
  const sizeFluid = normalizeValue("size-fluid-vw", row["size-fluid-vw"]);
  const color = normalizeValue("color-light", row["color-light"]);

  if (rowKey === "h1") {
    if (font) tokens["font-display"] = font;
    if (sizeMin) tokens["size-h1-min"] = sizeMin;
    if (sizeMax) tokens["size-h1-max"] = sizeMax;
    if (sizeMin && sizeFluid && sizeMax) {
      tokens["size-h1"] = `clamp(${sizeMin}, ${sizeFluid}, ${sizeMax})`;
    } else if (size) {
      tokens["size-h1"] = size;
    }
  }

  if (rowKey === "h2" && size) {
    tokens["size-h2"] = size;
  }

  if (rowKey === "body") {
    if (font) tokens["font-body"] = font;
    if (size) tokens["size-body"] = size;
    if (color) tokens["muted"] = color;
  }

  if (rowKey === "hero-h1-override") {
    if (sizeMin) tokens["size-hero-min"] = sizeMin;
    if (sizeMax) tokens["size-hero-max"] = sizeMax;
    if (sizeMin && sizeFluid && sizeMax) {
      tokens["size-hero"] = `clamp(${sizeMin}, ${sizeFluid}, ${sizeMax})`;
    } else if (size) {
      tokens["size-hero"] = size;
    }
  }
}

function rowsToTokenMap(rows: TokenRow[]): TokenMap {
  const tokens: TokenMap = {};
  let typeBodyFontFallback: string | number | null = null;
  let typeBodySizeFallback: string | number | null = null;
  let typeBodyColorFallback: string | number | null = null;
  let hasBodyToken = false;

  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    const tokenName = sanitizeName(String(row["token"] ?? ""));
    if (!tokenName) {
      continue;
    }

    for (const [key, value] of Object.entries(row)) {
      const column = sanitizeName(key);
      if (!column || column === "token" || !SCHEMA_COLUMNS.has(column)) {
        continue;
      }
      const normalized = normalizeValue(column, value);
      if (normalized === null) {
        continue;
      }
      tokens[`${tokenName}-${column}`] = normalized;
    }

    if (tokenName === "body") {
      hasBodyToken = true;
    }

    if (tokenName === "type-body") {
      typeBodyFontFallback = normalizeValue("font", row["font"]);
      typeBodySizeFallback = normalizeValue("size-px", row["size-px"]);
      typeBodyColorFallback = normalizeValue("color-light", row["color-light"]);
    }

    applyLegacyAliases(tokens, tokenName, row);
  }

  if (!hasBodyToken) {
    if (typeBodyFontFallback) tokens["font-body"] = typeBodyFontFallback;
    if (typeBodySizeFallback) tokens["size-body"] = typeBodySizeFallback;
    if (typeBodyColorFallback) tokens["muted"] = typeBodyColorFallback;
  }

  return tokens;
}

async function parseTokens(data: unknown): Promise<TokenMap> {
  if (!data || typeof data !== "object") {
    return {};
  }

  const envelope = extractSchemaEnvelope(data);
  const rows = extractTokenRows(envelope ?? data);
  if (rows.length > 0) {
    return rowsToTokenMap(rows);
  }

  if (isObject(data)) {
    return toFlatTokenMap(data);
  }

  return {};
}

function extractFontList(data: unknown): string[] {
  const envelope = extractSchemaEnvelope(data);
  const source = envelope ?? data;

  if (!isObject(source)) {
    return [];
  }

  const rawFonts = source["font-list"];
  if (!Array.isArray(rawFonts)) {
    return [];
  }

  const fonts = rawFonts
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }

      if (isObject(entry)) {
        const direct = entry["font-list"];
        if (typeof direct === "string") {
          return direct.trim();
        }

        const fallback = entry.font;
        if (typeof fallback === "string") {
          return fallback.trim();
        }
      }

      return "";
    })
    .filter((name) => name.length > 0);

  return Array.from(new Set(fonts));
}

export async function getTokens(): Promise<TokenMap> {
  if (CONTENT_SOURCE === "remote") {
    const remoteTokens = await getRemoteTokens();
    if (Object.keys(remoteTokens).length > 0) {
      return remoteTokens;
    }
  }

  const localTokens = await parseTokens(siteData as unknown);
  if (Object.keys(localTokens).length > 0) {
    return localTokens;
  }

  if (ENABLE_REMOTE_FALLBACK) {
    const remoteTokens = await getRemoteTokens();
    if (Object.keys(remoteTokens).length > 0) {
      return remoteTokens;
    }
  }

  return {};
}

export async function getFontList(): Promise<string[]> {
  if (CONTENT_SOURCE === "remote") {
    const remoteFonts = await getRemoteFontList();
    if (remoteFonts.length > 0) {
      return remoteFonts;
    }
  }

  const localFonts = extractFontList(siteData as unknown);
  if (localFonts.length > 0) {
    return localFonts;
  }

  if (ENABLE_REMOTE_FALLBACK) {
    const remoteFonts = await getRemoteFontList();
    if (remoteFonts.length > 0) {
      return remoteFonts;
    }
  }

  return [];
}

async function getRemoteTokens(): Promise<TokenMap> {
  if (!TOKENS_URL) {
    return {};
  }
  const response = await fetch(TOKENS_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Script request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  return parseTokens(data);
}

async function getRemoteFontList(): Promise<string[]> {
  if (!TOKENS_URL) {
    return [];
  }
  const response = await fetch(TOKENS_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Script request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  return extractFontList(data);
}
