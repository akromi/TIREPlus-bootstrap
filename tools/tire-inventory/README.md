# Tire Inventory viewer (local tool)

A single-file web app for browsing, filtering and printing the tire list from
a TIREPlus/Tekmetric **product export CSV** (the file named like
`product…TIREPlus_Orleans<yyyymmdd>.csv`).

This is an internal tool. It lives outside `site/`, so it is **never deployed**
to tireplus.ca, and the inventory data never leaves the browser it is loaded in.

## Use it

1. Open `tools/tire-inventory/index.html` in any browser (double-click works —
   no server, no install, works offline).
2. Drop the product export CSV anywhere on the page (or click **Load CSV…**).
3. The app keeps the data in that browser's localStorage, so the next time you
   open the page the list is already there. Load a newer export any time to
   replace it; **Forget saved data** (footer) wipes it.

## What it does

- Splits tires by the shop search-tag prefixes in `searchable_tags`:
  `w…` Winter, `as…` All Season, `aw…` All Weather, `s…` Summer, `u…` Used,
  `lt…` Light Truck, `st…` Trailer, `rf…` Run Flat — plus an
  *Other / untagged* bucket. Rows are tires when the export marks them
  `product_type = T`, they carry a tire tag, or their group is a "… Tires" group.
- Decodes the 7-digit tag into a size (`w2055516` → 205/55R16; sizes are also
  read from the description when the tag is missing) and offers
  Width / Aspect / Rim / Brand dropdown filters.
- Search box matches the tag exactly as typed at the counter (`w2055516`,
  `as225…`), and also sizes (`205/55R16`), brands, descriptions, item codes.
- **In stock only**, **Show inactive** and **Show cost** toggles — cost stays
  hidden (and out of print/export) unless switched on.
- **Print** produces a clean list with a header (filters, count, date, source
  file); with *Page per type* checked, the "All tires" view starts each tire
  type on its own page — one click prints the whole set of per-type lists.
- **Export CSV** / **Copy** extract exactly what is currently filtered, for
  Excel or e-mail.
- Sort by any column (click the header; third click restores the grouped
  type/size order).

## Optional: auto-load from a file

When the folder is served over HTTP (e.g. `npx serve tools/tire-inventory`),
the app also tries `data/products.csv` on startup. Drop the latest export at
`tools/tire-inventory/data/products.csv` for that.

The `data/` folder is **gitignored on purpose**: exports contain wholesale
cost prices, and this repo's history is not the place for them (see the
README's note on leaked secrets — same idea). Don't commit inventory exports.
