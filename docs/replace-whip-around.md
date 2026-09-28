# Bring Whip Around records

Sources checked 28 September 2026:

- [Assets export](https://help.whiparound.com/en/articles/3763496-bulk-updating-asset-information): Assets, Export, Export Assets to CSV. Keep the Whip Around ID.
- [Inspection history export](https://help.whiparound.com/en/articles/2898872-exporting-your-inspections): select a date range and rows, then Export and CSV. Excel is also available.
- [Defect export](https://help.whiparound.com/en/articles/2880197-exporting-defects): select the required records or status and export CSV or Excel.

## Map once, import in one command

Keep originals. Start a clean database with npm run migrate, without the demo seed. Copy fixtures/whip-around/mapping.json alongside the CSV files and edit its headings against your actual exports. Fixture headings and rows are illustrative: the help centre does not publish a full fixed header contract. Whip Around allows different selected columns and custom fields. Do not present these fixtures as a downloaded vendor file.

Each entity maps CSV column names to fields shown by npm run vehicle -- help. Map a stable identifier to source_id. Relationships use the source identifier of an earlier imported entity, not its display name. Entity order is assets, drivers, checklists, checklist_items, inspections, defects, repairs, services, notes. Every CSV column needs a mapping; use null deliberately to retain a column only in the original raw evidence. Convert localized dates to ISO timestamps with timezone offsets and dates to YYYY-MM-DD. Map result to pass, fail or unknown and severity to critical or review. Blank fields use defaults; unknown enums fail. Enter country, timezone and certificate type explicitly for each fleet before reviewing due dates.

```bash
npm run vehicle -- import whip-around ./your-export --dry-run
npm run vehicle -- import whip-around ./your-export
npm run vehicle -- export ./reconciliation-copy
```

Preview rolls back the entire import, including audit rows. Real import is atomic. Exact repeats skip. A changed source row or mapping stops the batch for review. Missing references, duplicate mapped fields, unknown headings and invalid values stop it too. All original rows and mapping instructions are retained in import_rows. Asset status defaults active, but imported critical defects place the asset on hold. Review all vehicle statuses before use.

Inspection summaries retain time, signer, outcome and meter reading. They are not marked complete because they lack the individual checklist answers; they never satisfy today's daily-check evidence. Importing them does not advance the current odometer. Review current asset mileage separately.

Import open defects into the working queue. The base does not import vendor closed-defect status or recreate historic repair sign-offs from a summary. Retain the complete original defect export and map reviewed repair evidence separately. Photo files, signatures, inspection PDFs, parts inventory, fuel, notifications and live connections do not migrate automatically. Archive their original files under your retention policy. This importer covers mapped records, not a byte-for-byte account transfer.

Compare asset and row counts, IDs, odometers, missing dates, open defects and currencies with the originals. Check a sample of histories end to end. Use your existing inspection process until a fleet manager approves the mapped records and operating workflow. Export contains all business records plus audit/import history in JSON and CSV; it is an interchange snapshot, not a restore command. Back up the database and retained files separately.
