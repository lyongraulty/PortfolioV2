import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readWorkbookRows } from "./import-projects-workbook.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKBOOK = path.join(ROOT, "content", "workbook", "workbook.xlsx");
const TMP_DIR = path.join(ROOT, ".next", "workbook-schema-migration");

export const SHEET_ORDER = ["Projects", "Blocks", "Media", "Credits", "TickerItems", "Links", "Settings", "Variables", "Fields"];

export const HEADERS = {
  Projects: ["page", "slug", "status", "title", "client", "studio", "year", "category", "template", "theme", "summary", "intro", "card_override", "hero_override", "featured", "sort_order"],
  Blocks: ["slug", "block_id", "order", "type", "layout", "variant", "tone", "eyebrow", "title", "copy", "caption", "caption_meta", "media_group", "credit_group", "link_group", "ticker_group", "spacing_before", "spacing_after", "section_height"],
  Media: ["slug", "media_group", "order", "purpose", "src", "detected_group", "detected_purpose", "label", "caption", "alt", "poster", "thumbnail_at", "aspect", "fit", "autoplay", "loop", "controls", "active", "notes"],
  Credits: ["slug", "credit_group", "block_id", "order", "role", "name", "url"],
  TickerItems: ["slug", "ticker_group", "order", "text"],
  Links: ["slug", "link_group", "order", "label", "url", "target"],
  Settings: ["key", "value", "notes"],
  Variables: ["category", "value", "label", "notes"],
  Fields: ["sheet", "field", "required", "allowed_category", "notes"],
};

function escapeXml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function rowKey(row, fields) {
  return fields.map((field) => String(row[field] ?? "")).join("::");
}

function upsert(rows, entry, keyFields) {
  const key = rowKey(entry, keyFields);
  const index = rows.findIndex((row) => rowKey(row, keyFields) === key);
  if (index >= 0) rows[index] = { ...rows[index], ...entry };
  else rows.push(entry);
}

function ensureColumns(rows, sheetName) {
  const headers = HEADERS[sheetName];
  return rows.map((row) => Object.fromEntries(headers.map((header) => [header, row[header] ?? ""])));
}

function syncHelperRows(sheets) {
  [
    ["block_type", "header", "Header", "Page or section header block."],
    ["block_type", "divider", "Divider", "Ticker or rhythm transition block."],
    ["layout", "full-bleed", "Full Bleed", "Viewport-scale media/header treatment."],
  ].forEach(([category, value, label, notes]) => {
    upsert(sheets.Variables, { category, value, label, notes }, ["category", "value"]);
  });

  [
    ["Blocks", "caption_meta", "false", "", "Small metadata paired with a media caption."],
    ["Blocks", "credit_group", "false", "", "Matches Credits.credit_group."],
    ["Blocks", "link_group", "false", "", "Matches Links.link_group."],
    ["Blocks", "ticker_group", "false", "", "Matches TickerItems.ticker_group."],
    ["Media", "label", "false", "", "Short media label for cover grids, links, or buttons."],
    ["Credits", "credit_group", "false", "", "Named credit group, e.g. making-of."],
    ["TickerItems", "ticker_group", "true", "", "Named ticker group, e.g. main."],
    ["Links", "link_group", "true", "", "Named link group."],
  ].forEach(([sheet, field, required, allowed_category, notes]) => {
    upsert(sheets.Fields, { sheet, field, required, allowed_category, notes }, ["sheet", "field"]);
  });
}

function rowsToMatrix(sheetName, rows) {
  const headers = HEADERS[sheetName];
  return [headers, ...ensureColumns(rows, sheetName).map((row) => headers.map((header) => row[header] ?? ""))];
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const mod = (value - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    value = Math.floor((value - mod) / 26);
  }
  return name;
}

function variableOptions(sheets) {
  const grouped = new Map();
  for (const row of sheets.Variables ?? []) {
    const category = String(row.category ?? "").trim();
    const value = String(row.value ?? "").trim();
    if (!category || !value) continue;
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(value);
  }
  return grouped;
}

function validationXml(sheetName, rows, sheets) {
  const headers = HEADERS[sheetName] ?? [];
  const options = variableOptions(sheets);
  const validations = [];
  const maxRow = Math.max(rows.length + 200, 1000);

  for (const field of sheets.Fields ?? []) {
    if (field.sheet !== sheetName || !field.allowed_category) continue;
    const columnIndex = headers.indexOf(field.field);
    const values = options.get(field.allowed_category) ?? [];
    if (columnIndex < 0 || values.length === 0) continue;

    const formula = `&quot;${escapeXml(values.join(","))}&quot;`;
    validations.push(
      `<dataValidation type="list" allowBlank="1" showErrorMessage="0" showInputMessage="1" sqref="${columnName(columnIndex)}2:${columnName(columnIndex)}${maxRow}"><formula1>${formula}</formula1></dataValidation>`,
    );
  }

  return validations.length ? `<dataValidations count="${validations.length}">${validations.join("")}</dataValidations>` : "";
}

function worksheetXml(sheetName, rows, sheets) {
  const matrix = rowsToMatrix(sheetName, rows);
  const maxCols = Math.max(...matrix.map((row) => row.length), 1);
  const maxRows = Math.max(matrix.length, 1);
  const cols = Array.from({ length: maxCols }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${index < 6 ? 18 : 28}" customWidth="1"/>`).join("");
  const sheetData = matrix
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          const style = rowIndex === 0 ? ' s="1"' : "";
          return `<c r="${columnName(colIndex)}${rowIndex + 1}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${columnName(maxCols - 1)}${maxRows}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetData}</sheetData>
  ${maxRows > 1 ? `<autoFilter ref="A1:${columnName(maxCols - 1)}${maxRows}"/>` : ""}
  ${validationXml(sheetName, rows, sheets)}
</worksheet>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${SHEET_ORDER.map((name, index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${SHEET_ORDER.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}
  <Relationship Id="rId${SHEET_ORDER.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${SHEET_ORDER.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF101010"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

async function writeFile(relative, content, tmpDir = TMP_DIR) {
  const file = path.join(tmpDir, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}

async function zipWorkbook(workbook = WORKBOOK, tmpDir = TMP_DIR) {
  const backup = `${workbook}.bak`;
  await fs.copyFile(workbook, backup);
  await fs.rm(workbook, { force: true });
  const command = `
    Add-Type -AssemblyName System.IO.Compression;
    Add-Type -AssemblyName System.IO.Compression.FileSystem;
    $zip = [System.IO.Compression.ZipFile]::Open('${workbook.replace(/'/g, "''")}', [System.IO.Compression.ZipArchiveMode]::Create);
    try {
      $root = '${tmpDir.replace(/'/g, "''")}';
      if (-not $root.EndsWith('\\')) { $root = $root + '\\'; }
      Get-ChildItem -LiteralPath '${tmpDir.replace(/'/g, "''")}' -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($root.Length).Replace('\\', '/');
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null;
      }
    } finally { $zip.Dispose(); }
  `;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], { encoding: "utf8" });
  if (result.status !== 0) {
    await fs.copyFile(backup, workbook).catch(() => {});
    throw new Error(result.stderr || result.stdout || result.error?.message || "Failed to write workbook.");
  }
}

export async function writeWorkbookSheets(sheets, { workbook = WORKBOOK, tmpDir = TMP_DIR } = {}) {
  await fs.rm(tmpDir, { recursive: true, force: true });
  await writeFile("[Content_Types].xml", contentTypesXml(), tmpDir);
  await writeFile("_rels/.rels", ROOT_RELS, tmpDir);
  await writeFile("xl/workbook.xml", workbookXml(), tmpDir);
  await writeFile("xl/_rels/workbook.xml.rels", workbookRelsXml(), tmpDir);
  await writeFile("xl/styles.xml", STYLES, tmpDir);
  for (const [index, sheetName] of SHEET_ORDER.entries()) {
    await writeFile(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheetName, sheets[sheetName] ?? [], sheets), tmpDir);
  }
  await zipWorkbook(workbook, tmpDir);
  await fs.rm(tmpDir, { recursive: true, force: true });
}

const colossalIntro = "This piece was an exciting challenge: visualizing breakthrough science in a way that felt both cinematic and clear. From microscopic cell animations to bold typographic transitions, every moment had to balance precision with energy — a rewarding push to make complexity feel intuitive and alive. I worked across motion design, some 3D, and a lot of the system thinking—building out the animated icon language, lower thirds, logo treatments, and transitions that carry the piece. The focus was on guiding the viewer's eye to what matters, when it matters, and keeping everything cohesive across a wide range of content.";
const bioIntro = "Acoustic intelligence for wild landscapes isn't a future idea—it's already listening. I handled motion design, 3D modeling, and visual effects—translating that data into something you can actually follow on screen. Turning audio into visuals, shaping patterns into something readable, and guiding attention to the meaningful parts. There's a lot of detail work behind the scenes too—down to masking out individual snowflakes in one of the spectrograph shots, just to get it to sit right.";
const coversBlurb = "Six covers, all with distinct styles and tones. Each piece called for a slightly different approach, but the throughline was restraint—finding the smallest move that makes the image feel alive.\n\nExcept for the water piece. I got to let loose on that one a little more with some directed liquid simulations.";
const tomBrownCopy = "For this true crime piece, the work leaned more into tone. I developed a series of moody, atmospheric animations that extend the feeling of the illustrations—letting moments linger, adding tension, and giving the visuals a sense of unease without overstating it.\n\nIt was less about movement and more about pacing and restraint—helping set the emotional temperature of the story.";
const fiftiethCopy = "I also contributed animation for the magazine's 50th anniversary feature—an especially meaningful piece to be part of.\n\nThe goal here was to support the storytelling in a way that felt considered and respectful of that history—adding motion where it helps, and staying out of the way where it doesn't.";

async function main() {
  const workbookRows = await readWorkbookRows(WORKBOOK);
  const sheets = Object.fromEntries(SHEET_ORDER.map((name) => [name, workbookRows.get(name) ?? []]));
  syncHelperRows(sheets);

  const blocks = sheets.Blocks;
  [
    ["colossal", "signal-hero", 1, "header", "full-bleed", "signal-hero", "signal", "Transmission - 003 / Colossal Biosciences", "Dire Wolf", colossalIntro, "", "", "colossal-hero", "", "", "main", "md", "lg", "full"],
    ["colossal", "making-of-step-01", 10, "process", "process-sequence", "signal-step", "signal", "Making Of Sequence", "1) Collect Dire Wolf Cells", "", "Making Of - Step 01", "01 / 05", "making-of-step-01", "", "", "", "md", "md", "auto"],
    ["colossal", "making-of-step-02-03", 20, "process", "process-sequence", "signal-step", "signal", "Making Of Sequence", "2/3) Sequence DW Genome & Identify Pure Gray Wolf", "", "Making Of - Step 02 / 03", "02 / 05", "making-of-step-02-03", "", "", "", "md", "md", "auto"],
    ["colossal", "making-of-step-04", 30, "process", "process-sequence", "signal-step", "signal", "Making Of Sequence", "4) Sequence Gray Wolf genome", "", "Making Of - Step 04", "03 / 05", "making-of-step-04", "", "", "", "md", "md", "auto"],
    ["colossal", "making-of-step-05-07", 40, "process", "process-sequence", "signal-step", "signal", "Making Of Sequence", "5-7) Gene Alignment, Filter Variants & Genome Engineering", "", "Making Of - Step 05 / 07", "04 / 05", "making-of-step-05-07", "", "", "", "md", "md", "auto"],
    ["colossal", "making-of-step-08", 50, "process", "process-sequence", "signal-step", "signal", "Making Of Sequence", "8) Clone Cells", "", "Making Of - Step 08", "05 / 05", "making-of-step-08", "", "", "", "md", "lg", "auto"],
    ["colossal", "making-of-credits", 60, "credits", "grid", "signal-credits", "signal", "", "Credits - Making Of", "", "", "", "", "making-of", "", "", "md", "lg", "auto"],
    ["colossal", "bioacoustics-header", 70, "header", "full-bleed", "signal-section-header", "signal", "Transmission - 003 / Colossal Biosciences", "Bioacoustics", bioIntro, "", "", "bioacoustics-header", "", "", "", "lg", "lg", "tall"],
    ["colossal", "yellowstone-step-01", 80, "process", "process-sequence", "signal-step", "signal", "Yellowstone Sequence", "1) Yellowstone Bioacoustics", "", "Yellowstone Bioacoustics", "01 / 03", "yellowstone-step-01", "", "", "", "md", "md", "auto"],
    ["colossal", "yellowstone-step-02", 90, "process", "process-sequence", "signal-step", "signal", "Yellowstone Sequence", "2) Spectrogram and Map", "", "Spectrogram and Map", "02 / 03", "yellowstone-step-02", "", "", "", "md", "md", "auto"],
    ["colossal", "yellowstone-step-03", 100, "process", "process-sequence", "signal-step", "signal", "Yellowstone Sequence", "3) Acoustic Recording Unit", "", "Acoustic Recording Unit", "03 / 03", "yellowstone-step-03", "", "", "", "md", "lg", "auto"],
    ["colossal", "yellowstone-credits", 110, "credits", "grid", "signal-credits", "signal", "", "Credits - Yellowstone Bioacoustics", "", "", "", "", "yellowstone", "", "", "md", "lg", "auto"],
    ["texas-monthly", "editorial-header", 1, "header", "single", "editorial-header", "paper", "Editorial Animation · 2022–2025", "Texas Monthly", "", "", "", "", "", "", "main", "md", "lg", "auto"],
    ["texas-monthly", "animated-covers", 10, "gallery", "cover-grid", "editorial-covers", "paper", "", "Animated Covers", coversBlurb, "", "", "covers", "animated-covers", "", "", "lg", "lg", "auto"],
    ["texas-monthly", "tom-browns-body", 20, "feature", "media-left", "editorial-feature", "paper", "", "Tom Brown's Body", tomBrownCopy, "Texas Monthly · Tom Brown's Body · 2023", "", "tom-browns-body", "tom-browns-body", "", "", "lg", "lg", "auto"],
    ["texas-monthly", "fiftieth-anniversary", 30, "feature", "media-right", "editorial-anniversary", "paper", "", "50th Anniversary", fiftiethCopy, "", "", "fiftieth-anniversary", "fiftieth-anniversary", "fiftieth-anniversary", "", "lg", "lg", "auto"],
  ].forEach((values) => upsert(blocks, Object.fromEntries(HEADERS.Blocks.map((header, index) => [header, String(values[index] ?? "")])), ["slug", "block_id"]));

  const media = sheets.Media;
  [
    ["colossal", "colossal-hero", 1, "hero", "projects/colossal/colossal_pageheader2.mp4", "", "hero", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["colossal", "bioacoustics-header", 1, "hero", "projects/colossal/colossal_pageheader3.mp4", "", "hero", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["colossal", "making-of-step-01", 1, "step_01", "projects/colossal/Belle Epoch - Colossal - Dire Wolf Making Of - Cutdowns - 1920 x 1080 - Step 1 _SHORT.mp4", "", "", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["colossal", "making-of-step-02-03", 1, "step_02_03", "projects/colossal/Belle Epoch - Colossal - Dire Wolf Making Of - Cutdowns - 1920 x 1080 - Step 2 and 3 - SHORT.mp4", "", "", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["colossal", "making-of-step-04", 1, "step_04", "projects/colossal/Belle Epoch - Colossal - Dire Wolf Making Of - Cutdowns - 1920 x 1080 - Step 4 - SHORT.mp4", "", "", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["colossal", "making-of-step-05-07", 1, "step_05_07", "projects/colossal/Belle Epoch - Colossal - Dire Wolf Making Of - Cutdowns - 1920 x 1080 - Step 5 - 7 - SHORT.mp4", "", "", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["colossal", "making-of-step-08", 1, "step_08", "projects/colossal/Belle Epoch - Colossal - Dire Wolf Making Of - Cutdowns - 1920 x 1080 - Step 8 - SHORT.mp4", "", "", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["colossal", "yellowstone-step-01", 1, "yellowstone_master", "projects/colossal/Belle Epoch - Colossal - Yellowstone Bioacoustics - H264 4K - TITLE.mp4", "", "", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["colossal", "yellowstone-step-02", 1, "yellowstone_map", "projects/colossal/Belle Epoch - Colossal - Yellowstone Bioacoustics - H264 4K - Spectrogram and MAP.mp4", "", "", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["colossal", "yellowstone-step-03", 1, "yellowstone_aru", "projects/colossal/Belle Epoch - Colossal - Yellowstone Bioacoustics - ARU.mp4", "", "", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["texas-monthly", "covers", 1, "cover", "projects/texas-monthly/TexasMonthly_Selena.mp4", "", "", "Selena", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["texas-monthly", "covers", 2, "cover", "projects/texas-monthly/TexasMonthly_bumscover_H264.mp4", "", "", "Greg Abbott – Bum Steer of the Year", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["texas-monthly", "covers", 3, "cover", "projects/texas-monthly/TexasMonthly_Water_CoverRatio_Title.mp4", "", "", "Who's Wasting Our Water?", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["texas-monthly", "covers", 4, "cover", "projects/texas-monthly/TexasMonthly_TrumpsApostle_V06.mp4", "", "", "Trump's Apostle", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["texas-monthly", "covers", 5, "cover", "projects/texas-monthly/TexasMonthly_ComeAndFakeIt.mp4", "", "", "Come and Fake It", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["texas-monthly", "covers", 6, "cover", "projects/texas-monthly/TexasMonthly_TomBrownsBody_V01.mp4", "", "", "Tom Brown's Body", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["texas-monthly", "tom-browns-body", 1, "feature_video", "projects/texas-monthly/TexasMonthly_TomBrownsBody_ALL.mp4", "", "", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["texas-monthly", "fiftieth-anniversary", 1, "web_video", "projects/texas-monthly/TexasMontly50th_Web.mp4", "", "", "Web Version ↗", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
    ["texas-monthly", "fiftieth-anniversary", 2, "feature_video", "projects/texas-monthly/TexasMonthly_50thAll.mp4", "", "", "", "", "", "", "", "", "", "", "true", "true", "false", "true", "seeded hardcoded"],
  ].forEach((values) => {
    const normalized = values.length > HEADERS.Media.length ? [...values.slice(0, 14), ...values.slice(15)] : values;
    upsert(media, Object.fromEntries(HEADERS.Media.map((header, index) => [header, String(normalized[index] ?? "")])), ["slug", "media_group", "src"]);
  });

  const credits = sheets.Credits;
  [
    ["colossal", "making-of", "", 1, "Creative Lead", "Chris Klee", ""], ["colossal", "making-of", "", 2, "Director", "Ryan Padgett", ""], ["colossal", "making-of", "", 3, "Visual Designer", "Nathan Walker", ""], ["colossal", "making-of", "", 4, "Editor", "Kaley Hanson", ""], ["colossal", "making-of", "", 5, "Motion Designer", "Lyon Graulty", ""],
    ["colossal", "yellowstone", "", 1, "Creative Lead", "Chris Klee", ""], ["colossal", "yellowstone", "", 2, "Director", "Ryan Padgett", ""], ["colossal", "yellowstone", "", 3, "Motion Designer", "Lyon Graulty", ""], ["colossal", "yellowstone", "", 4, "Editor", "Kaley Hanson", ""],
    ["texas-monthly", "animated-covers", "", 1, "Animation by", "Lyon Graulty", ""], ["texas-monthly", "animated-covers", "", 2, "Produced by", "Emily Kimbro", ""], ["texas-monthly", "animated-covers", "", 3, "Illustrations by", "Mercedes deBellard", ""], ["texas-monthly", "animated-covers", "", 4, "Illustrations by", "Mike McQuade", ""], ["texas-monthly", "animated-covers", "", 5, "Illustrations by", "Nicolás Ortega", ""], ["texas-monthly", "animated-covers", "", 6, "Illustrations by", "Tim O'Brien", ""], ["texas-monthly", "animated-covers", "", 7, "Illustrations by", "Hokyoung Kim", ""], ["texas-monthly", "animated-covers", "", 8, "Illustrations by", "Doug Chayka", ""],
    ["texas-monthly", "tom-browns-body", "", 1, "Animation by", "Lyon Graulty", ""], ["texas-monthly", "tom-browns-body", "", 2, "Produced by", "Emily Kimbro", ""], ["texas-monthly", "tom-browns-body", "", 3, "Illustrations by", "Hokyoung Kim", ""],
    ["texas-monthly", "fiftieth-anniversary", "", 1, "Produced by", "Emily Kimbro", ""], ["texas-monthly", "fiftieth-anniversary", "", 2, "Animation by", "Lyon Graulty", ""], ["texas-monthly", "fiftieth-anniversary", "", 3, "Illustration by", "Braulio Amado", ""],
  ].forEach((values) => upsert(credits, Object.fromEntries(HEADERS.Credits.map((header, index) => [header, String(values[index] ?? "")])), ["slug", "credit_group", "role", "name"]));

  const tickers = sheets.TickerItems;
  ["Colossal Biosciences", "Dire Wolf", "De-extinction - 2025", "Science-Tech Design", "Motion Design: Lyon Graulty"].forEach((text, index) => upsert(tickers, { slug: "colossal", ticker_group: "main", order: String(index + 1), text }, ["slug", "ticker_group", "order"]));
  ["Texas Monthly", "Editorial Animation", "2022 – 2025", "Animated Cover Design"].forEach((text, index) => upsert(tickers, { slug: "texas-monthly", ticker_group: "main", order: String(index + 1), text }, ["slug", "ticker_group", "order"]));

  upsert(sheets.Links, { slug: "texas-monthly", link_group: "fiftieth-anniversary", order: "1", label: "Web Version ↗", url: "https://www.texasmonthly.com/50th-anniversary-issue/", target: "_blank" }, ["slug", "link_group", "url"]);

  await writeWorkbookSheets(sheets);
  console.log("Migrated content/workbook/workbook.xlsx schema and seeded hardcoded content.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
