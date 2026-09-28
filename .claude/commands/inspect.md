---
description: Fleet inspect
---

# Inspect

Read the asset, driver and checklist. Ask the operator for every item result, failure note, odometer and signed name. Run `npm run vehicle -- inspect <asset> <driver> <checklist> <json>`. JSON is `{ "odometer": 12345, "signed_by": "Actual inspector", "answers": [{"item":"Exact checklist item", "result":"pass", "note":""}] }` with one answer for every item. Never fill in passing answers from absence of defects. The capture time is now. Report new defects and any hold, then read compliance. A complete check does not authorise driving.
