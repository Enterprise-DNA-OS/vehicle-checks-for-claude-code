# Vehicle Checks for Claude Code

For the fleet office: vehicles, drivers, daily inspection evidence, defects, repairs and due dates in one database. The demo fleet is fictional. Fill in the real business identity in brand.json before use.

## Working rules

Read records before answering. Use the CLI for every record operation. If a name or ID is ambiguous, list the candidates and ask. Never invent observations, signatures, repair evidence or licence checks. Use the actual operator-provided details.

Drafts stay in drafts. Printed documents stay in docs-out. A person reviews and shares them. Never send, upload evidence to another service, process a payment or delete records from here. No deletion command is provided.

A critical defect places the asset on hold. Repairs close defects without releasing the asset. Release needs an explicit instruction from a competent reviewer, their name and evidence, with no open critical faults. A status of active and an empty findings list do not certify a vehicle as roadworthy.

Inspection and repair evidence is append-only through the CLI. Corrections require a reviewed migration preserving the original evidence. The database audit is not tamper proof. Never downgrade a critical defect merely to release a vehicle.

## Routing

| Job | Command |
| --- | --- |
| Assets | `/assets` |
| Drivers | `/drivers` |
| Checklists | `/checklists` |
| Inspections | `/inspections` |
| Pre start | `/pre-start` |
| Defects | `/defects` |
| Defects due | `/defects-due` |
| Repeat defects | `/repeat-defects` |
| Repairs | `/repairs` |
| Repair costs | `/repair-costs` |
| Services due | `/services-due` |
| Certificates | `/certificates` |
| Driver review | `/driver-review` |
| Depot review | `/depot-review` |
| Inspection quality | `/inspection-quality` |
| Attention | `/attention` |
| Compliance | `/compliance` |
| Notes | `/notes` |
| Record | `/record` |
| Add | `/add` |
| Update | `/update` |
| Log | `/log` |
| Inspect | `/inspect` |
| Repair | `/repair` |
| Release | `/release` |
| Import | `/import` |
| Export | `/export` |
| Weekly review | `/weekly-review` |
| Draft repair | `/draft-repair` |
| Draft handover | `/draft-handover` |
| Customise | `/customise` |
| New view | `/new-view` |

## Data and operations

scripts/vehicle.mjs is the only record CLI. Read its help for field names. Migrations live in supabase/migrations. DATABASE_URL selects Postgres, otherwise DATA_DIR selects embedded PGlite. Use a separate empty database for live imports; never seed it with demo records.

Vehicle date comparisons use the asset timezone. Driver licence dates use UTC. Daily checks are per day, not per shift. Historical imported inspection summaries do not satisfy daily check evidence. Repair money is integer cents with NZD or AUD recorded on each repair; never combine currencies.

One business per database. Configure access roles, backups, restore tests, retained evidence storage and a retention policy before shared use. Read docs/compliance.md before describing any requirement. Operator-configured thresholds are not laws.

Every recurring job has a command in .claude/commands. Any coding agent reads AGENTS.md and this file. Omni by Enterprise DNA installs and operates the agreed version: https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=whip-around&utm_medium=instructions
