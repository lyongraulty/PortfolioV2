import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildGeneratedContentFromRows } from "./content-pipeline.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKBOOK_DIR = path.join(ROOT, "content", "workbook");
const SOURCE_SITE_DATA = path.join(ROOT, "content", "site-data.json");
const INPUT_XLSX = path.join(WORKBOOK_DIR, "workbook.xlsx");

const SHEETS = [
  { name: "Projects", required: true },
  { name: "Blocks", required: true },
  { name: "Media", required: true },
  { name: "Credits", required: true },
  { name: "TickerItems", required: false },
  { name: "Links", required: false },
  { name: "Settings", required: true },
  { name: "Variables", required: true },
  { name: "Fields", required: true },
];

function xmlDecode(value) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function slugifyHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowsToObjects(rows) {
  const headers = (rows[0] ?? []).map(slugifyHeader);
  return rows
    .slice(1)
    .filter((row) => row.some((value) => String(value ?? "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function colIndex(ref) {
  const match = String(ref).match(/[A-Z]+/i);
  if (!match) return 0;
  return match[0].toUpperCase().split("").reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Could not find XLSX central directory.");
}

function readZipEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  let offset = centralOffset;
  const end = centralOffset + centralSize;

  while (offset < end) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8").replace(/\\/g, "/");

    entries.set(name, { method, compressedSize, uncompressedSize, localOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return {
    get(name) {
      const normalized = name.replace(/\\/g, "/").replace(/^\/+/, "");
      const entry = entries.get(normalized);
      if (!entry) return "";
      const local = entry.localOffset;
      if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error(`Invalid local header for ${normalized}`);
      const fileNameLength = buffer.readUInt16LE(local + 26);
      const extraLength = buffer.readUInt16LE(local + 28);
      const dataStart = local + 30 + fileNameLength + extraLength;
      const compressed = buffer.slice(dataStart, dataStart + entry.compressedSize);
      if (entry.method === 0) return compressed.toString("utf8");
      if (entry.method === 8) return zlib.inflateRawSync(compressed).toString("utf8");
      throw new Error(`Unsupported ZIP compression method ${entry.method} for ${normalized}`);
    },
  };
}

function parseAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([\w:]+)="([^"]*)"/g)) {
    attrs[match[1]] = xmlDecode(match[2]);
  }
  return attrs;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/g)].map(([si]) =>
    [...si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(([, text]) => xmlDecode(text)).join(""),
  );
}

function parseRelationships(xml) {
  const map = new Map();
  for (const match of xml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const attrs = parseAttributes(match[0]);
    if (attrs.Id && attrs.Target) map.set(attrs.Id, attrs.Target.replace(/\\/g, "/"));
  }
  return map;
}

function parseWorkbookSheets(xml, rels) {
  const sheets = new Map();
  for (const match of xml.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const attrs = parseAttributes(match[0]);
    const relId = attrs["r:id"];
    const target = relId ? rels.get(relId) : "";
    if (!attrs.name || !target) continue;
    const normalizedTarget = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^xl\//, "")}`;
    sheets.set(attrs.name, normalizedTarget);
  }
  return sheets;
}

function cellText(cellXml, sharedStrings) {
  const attrs = parseAttributes(cellXml.match(/^<c\b[^>]*>/)?.[0] ?? "");
  if (attrs.t === "inlineStr") {
    return [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(([, text]) => xmlDecode(text)).join("");
  }
  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  if (attrs.t === "s") return sharedStrings[Number(value)] ?? "";
  return xmlDecode(value);
}

function parseWorksheet(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    const rowXml = rowMatch[1];
    for (const cellMatch of rowXml.matchAll(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)) {
      const cellXml = cellMatch[0];
      const attrs = parseAttributes(cellXml.match(/^<c\b[^>]*>/)?.[0] ?? cellXml);
      const index = colIndex(attrs.r);
      cells[index] = cellText(cellXml, sharedStrings);
    }
    while (cells.length > 0 && (cells[cells.length - 1] ?? "") === "") cells.pop();
    rows.push(cells.map((value) => value ?? ""));
  }
  return rows.filter((row) => row.some((value) => String(value).trim()));
}

export async function readWorkbookRows(workbookPath = INPUT_XLSX) {
  const buffer = await fs.readFile(workbookPath);
  const zip = readZipEntries(buffer);
  const sharedStrings = parseSharedStrings(zip.get("xl/sharedStrings.xml"));
  const rels = parseRelationships(zip.get("xl/_rels/workbook.xml.rels"));
  const sheets = parseWorkbookSheets(zip.get("xl/workbook.xml"), rels);
  const workbookRows = new Map();

  for (const sheet of SHEETS) {
    const target = sheets.get(sheet.name);
    if (!target) {
      if (sheet.required) throw new Error(`Missing sheet "${sheet.name}" in ${INPUT_XLSX}`);
      workbookRows.set(sheet.name, []);
      console.log(`Skipped missing optional sheet ${sheet.name}`);
      continue;
    }
    const rows = parseWorksheet(zip.get(target), sharedStrings);
    workbookRows.set(sheet.name, rowsToObjects(rows));
    console.log(`Read ${sheet.name}`);
  }

  return workbookRows;
}

async function main() {
  const workbookRows = await readWorkbookRows();

  const result = await buildGeneratedContentFromRows({
    sourceSiteData: await readJson(SOURCE_SITE_DATA, {}),
    projectRows: workbookRows.get("Projects") ?? [],
    blockRows: workbookRows.get("Blocks") ?? [],
    mediaRows: workbookRows.get("Media") ?? [],
    creditRows: workbookRows.get("Credits") ?? [],
    tickerRows: workbookRows.get("TickerItems") ?? [],
    linkRows: workbookRows.get("Links") ?? [],
    variableRows: workbookRows.get("Variables") ?? [],
    source: "workbook",
  });
  console.log(`Generated ${result.projects} project page${result.projects === 1 ? "" : "s"} with ${result.warnings} warning${result.warnings === 1 ? "" : "s"}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
