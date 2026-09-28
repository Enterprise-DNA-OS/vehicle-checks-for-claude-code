# Vehicle Checks for Claude Code

The fleet office desk for missed daily checks, open defects, workshop follow-up and vehicle evidence. Your records in a database you own. Built by Enterprise DNA. MIT licence.

| Do it yourself | We customise it | We run it for you |
| --- | --- | --- |
| Free source. Follow the quick start. | Your inspection rules, Whip Around export mapping, mobile capture and paperwork. | Installed and operated through Omni by Enterprise DNA. One setup fee, then a retainer. |

[Talk to Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=whip-around&utm_medium=readme) · [Instead of Whip Around](https://enterprisedna.co/omni/instead-of/whip-around?utm_source=github&utm_medium=readme&utm_campaign=whip-around)

Use Claude Code, Codex, OpenCode or Cursor. Read AGENTS.md and CLAUDE.md. The free base is a working fleet office desk with printable evidence. A driver phone app and live connections can be scoped into your custom version.

## Quick start

```bash
git clone https://github.com/Enterprise-DNA-OS/vehicle-checks-for-claude-code.git
cd vehicle-checks-for-claude-code
npm install
npm run demo
npm run vehicle -- weekly-review
npm run view
npm run docs
```

Node 20 or newer. PGlite runs locally with no database service. Set DATABASE_URL for Postgres with the same migrations. DATA_DIR chooses local storage. Demo rows are fictional and include an expired CoF, a held truck, a repeated tyre defect, overdue services, missing checks and an expired driver licence record. Seed is idempotent and does not overwrite edits. For a real fleet, use an empty database, run npm run migrate and do not seed.

Source is free. Hosting, agent subscriptions and support are separate costs. Whip Around's pricing page redirected to its homepage when checked on 28 September 2026. Its older help article publishes asset-based plan prices, but this build does not treat those as a current quote. Compare the actual contract and required collection workflow before deciding to switch.

## The fleet office week

- `/pre-start`: complete checks by vehicle-local date, open critical faults and holds. `/inspect` captures every checklist answer and a signed name in one transaction.
- `/defects-due`: overdue defects and unassigned work. `/repeat-defects` groups recurring component faults over ninety days.
- `/repair`: record a technician, repair evidence and cost, then close the selected fault. `/release` separately records a named review after critical faults are closed.
- `/services-due`: date and odometer thresholds, including distance remaining. `/certificates` and `/driver-review`: entered expiry evidence.
- `/weekly-review`: the daily check queue, overdue defect work, services and compliance findings together.
- `/draft-repair` and `/draft-handover`: evidence-backed internal drafts. Nothing sends.

Run npm run vehicle -- help for all routes and allowed fields. Reads produce aligned text or --json. Relationships accept case-insensitive names, full IDs and ID prefixes. Ambiguity lists candidates and exits 1. Add and update take one JSON object quoted for the shell. Log adds a fleet office note. Every business record change writes database audit history.

## Checks, defects and release

Inspect requires every item exactly once, an odometer that does not go backwards, an actual signed name and a note for each failure. It snapshots item wording and criticality in the inspection. Failed items create defects; critical failures place the vehicle on hold. Inspecting a held vehicle is allowed for evidence collection, but does not release it. A pass does not erase earlier defects.

Repair records use actual evidence and integer cents in NZD or AUD. Repair closes a defect, never the vehicle hold. Release requires a named reviewer and evidence and refuses while critical defects remain open. An administrative release is not a certificate of roadworthiness. The operator still checks registration, certificates, physical condition and the remaining findings.

A generic imported or added inspection summary is historical evidence only. It never counts as a complete daily check. Inspection and repair entries are append-only through the CLI. There is no deletion route. Audit history is retained but database administrators can alter it. One daily check per asset-local day is the default policy; shifts and fleet-specific inspection requirements need a reviewed extension. Driver date checks use UTC.

The inspection form is a configurable example, not an exhaustive statutory checklist. Read [the sourced compliance rules](docs/compliance.md). Certificate dates are entered from actual evidence; the software does not infer statutory periods or verify government records. The demo is not suitable as an unrevised operating safety system.

## Paperwork and views

npm run docs generates vehicle handovers, inspection evidence records with captured item answers, and repair records. npm run view generates fleet checks, workshop and recorded repair cost dashboards. Set the business name, logo and colours in brand.json. The pages are read-only HTML, suitable for printing. /new-view adds a report without building an application.

The base has no offline phone capture, camera/signature workflow, GPS tracking, parts inventory or fuel management. [Why no front end](docs/why-no-front-end.md) explains the office workflow and what a custom driver app adds. Keep the existing collection process until the replacement is tested with drivers.

## Ten questions across your fleet

Whip Around has its own reports and custom dashboards. These are cross-record questions the free version answers today, not an unsupported claim that the vendor cannot produce a similar report.

1. Which vehicles have no complete check today in their own timezone? (`pre-start`)
2. Which critical defects still block a held vehicle? (`defects`)
3. Which overdue defects still have no owner? (`defects-due`)
4. Which vehicle components have repeat faults within ninety days? (`repeat-defects`)
5. Which services are due by date or odometer, whichever comes first? (`services-due`)
6. Which imported inspections lack item-level evidence? (`inspection-quality`)
7. Which depots carry the most held vehicles and open critical defects? (`depot-review`)
8. What repair costs have been entered for each vehicle, separated by currency? (`repair-costs`)
9. Which certificate and registration dates need review? (`certificates`)
10. Which active drivers have missing or expiring licence records? (`driver-review`)

## Your first hour: ten things to ask for

1. Put our business name and logo on the handover.
2. Add our vehicles, depots and timezones.
3. Add our actual driver licence evidence.
4. Build the checklist our qualified fleet manager has approved.
5. Mark which faults require an immediate hold.
6. Add our certificate and registration expiry dates.
7. Set the workshop's date and distance service thresholds.
8. Map our actual Whip Around export columns.
9. Show repeated defects by vehicle and component.
10. Make a report for the Monday workshop meeting.

Use /customise for fields, rules or reports. Add a migration, test it against demo evidence and preserve historic checks. Back up real records before applying migrations.

## Bring your history

Follow [the replacement guide](docs/replace-whip-around.md). Whip Around documents CSV exports for assets, inspection history and defects. Map actual columns once, preview the one-command import and reconcile it before using the records. Fixture headers are illustrative. Exact repeats skip; changed source rows fail for review; failed batches roll back. Raw source rows and mappings are retained.

Open defects import into the working queue. Closed-defect status, photos, signatures and detailed historic repair sign-offs require a separate review and retained originals. Export writes every business entity, captured answer, audit row and raw import row to JSON and CSV. It is an interchange snapshot, not a recovery tool.

## Verification and operations

npm test runs on an isolated temporary database. It exercises every read route, capture, hold and release rules, repair arithmetic, ambiguous names, invalid input, atomic import, repeat import, preview rollback, audit evidence, exports, drafts, documents and views. CI is configured for Windows and Linux PGlite, plus a disposable Postgres service. Local test results do not prove hosted CI has run.

One business per database. Configure least-privilege access, tested database/file backups and retention before sharing it. No tenant isolation is included. Treat driver records, originals and generated reports as business evidence with controlled access. Keep the database and referenced attachments together in recovery planning.
