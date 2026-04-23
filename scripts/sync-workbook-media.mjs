import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectDetectedFiles, detectMedia, rowByHeaders, sortMediaRows } from "./content-pipeline.mjs";
import { readWorkbookRows } from "./import-projects-workbook.mjs";
import { HEADERS, SHEET_ORDER, writeWorkbookSheets } from "./migrate-workbook-content-schema.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKBOOK = path.join(ROOT, "content", "workbook", "workbook.xlsx");
const TMP_DIR = path.join(ROOT, ".next", "workbook-media-sync");

function text(value) {
  return String(value ?? "").trim();
}

function keyFor(row) {
  return `${text(row.slug)}::${text(row.src)}`;
}

function ensureSheets(workbookRows) {
  return Object.fromEntries(SHEET_ORDER.map((sheetName) => [sheetName, workbookRows.get(sheetName) ?? []]));
}

async function main() {
  const workbookRows = await readWorkbookRows(WORKBOOK);
  const sheets = ensureSheets(workbookRows);
  const mediaRows = sheets.Media;
  const known = new Set(mediaRows.map(keyFor));
  const files = await collectDetectedFiles();
  let added = 0;

  for (const src of files) {
    const detected = detectMedia(src);
    if (!detected.slug) continue;

    const key = `${detected.slug}::${src}`;
    if (known.has(key)) continue;

    mediaRows.push({
      ...rowByHeaders(HEADERS.Media),
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

  if (added > 0) {
    sheets.Media = mediaRows.sort(sortMediaRows);
    await writeWorkbookSheets(sheets, { workbook: WORKBOOK, tmpDir: TMP_DIR });
  }

  console.log(`Workbook media sync complete. Added ${added} row${added === 1 ? "" : "s"}.`);
}

await main();
