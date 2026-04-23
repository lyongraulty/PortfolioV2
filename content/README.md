# Local Content Pipeline

The editable source file is:

- `content/workbook/workbook.xlsx`

Open it in LibreOffice Calc, edit the sheets, save, then import it.

Generated files live in `content/generated/`:

- `project-content.json` is the new schema.
- `site-data.json` is a compatibility export for the current app.
- `content-errors.json` records warnings from the generator.

## Commands

```bash
npm run content:init
npm run content:sync-media
npm run content:build
npm run content:workbook
npm run content:import-workbook
npm run content:sync-workbook-media
npm run sync:bunny-media
```

`sync:bunny-media` refreshes `content/bunny-media.json` from Bunny Storage using the Bunny settings in `.env.local`.

`content:import-workbook` reads `content/workbook/workbook.xlsx` and regenerates JSON directly. Use this after editing and saving the workbook in LibreOffice Calc.

`content:sync-workbook-media` scans `content/bunny-media.json` and local `public/projects/` files, appends missing rows to the workbook `Media` sheet, and preserves existing manual rows.

`content:migrate-schema` is a one-time helper for expanding older workbooks to the current schema. Close the workbook in Calc before running it.

## Naming

Filename detection is a convenience layer, not a hard rule. Explicit sheet values win.

Useful filename hints:

- `card`
- `hero`
- `pageheader`
- `thumb`
- `poster`
- `fallback`
- `step`
- `process`
- `galleryA`, `galleryB`
- `cover`
- `still`
- `album`
- `styleframe`

Media uses `purpose`. Credits use `role`.

## Helper Sheets

Use the `Variables` sheet for dropdown values. The generator also validates strict fields against these values and writes warnings to `content/generated/content-errors.json`.

`Media.purpose` is intentionally flexible. The helper sheet includes common suggested values, but custom project-specific values like `step_01`, `yellowstone_master`, or `cover_grid_feature` are allowed.

Use the `Fields` sheet to see every available variable, whether it is required, and which dropdown category applies.

## Structured Project Content

The workbook schema supports project-specific art direction without hardcoding copy in React:

- `Blocks.credit_group` maps a block to grouped rows in `Credits`.
- `Blocks.link_group` maps a block to grouped rows in `Links`.
- `Blocks.ticker_group` maps a block to grouped rows in `TickerItems`.
- `Blocks.caption_meta` stores small caption metadata like `01 / 05`.
- `Media.label` stores visible labels such as editorial cover titles.
- `Credits.credit_group` names reusable credit groups.
- `TickerItems` stores project ticker copy.
- `Links` stores external links such as article/web-version links.
