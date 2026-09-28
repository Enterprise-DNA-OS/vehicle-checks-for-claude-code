# Fleet evidence checks

Checked 28 September 2026. Output is a list of missing or overdue records for a competent person's review. It is not certification, a substitute for a physical inspection, or a complete legal checklist. A passing list does not authorise driving.

| Rule | What the program checks | Source and scope |
| --- | --- | --- |
| NZ-CERTIFICATE | Entered WoF or CoF expiry missing or before the asset's local date | [NZTA certificate of fitness](https://nzta.govt.nz/vehicles/warrants-and-certificates/certificate-of-fitness): operators must keep vehicles at CoF condition between inspections. The program reads entered expiry dates; it does not calculate statutory intervals. |
| CERTIFICATE-REVIEW | Missing or expired recorded AU inspection date; NZ not-applicable classifications without a review date | Operator evidence prompt. AU requirements depend on vehicle and state. No nationwide interval is assumed. |
| DAILY-CHECK | No complete item-level check on the asset's current local date when check_required is true | [NHVR daily checks guide](https://www.nhvr.gov.au/files/media/document/474/202405-0434-creating-heavy-vehicle-daily-checks.pdf) describes checks before leaving the yard, depot or rest area. [NHVAS maintenance accreditation guide](https://wws.nhvr.gov.au/files/202106-1213-nhvas-maintenance-management-accreditation-guide.pdf) sets daily check requirements for that accreditation scheme. The base uses an operator-configured daily schedule, not a claim that every Australian vehicle is subject to NHVAS. |
| CRITICAL-DEFECT | Open defects classified critical | Internal hold policy supporting fault reporting and maintenance review. Any failed item marked critical creates a hold. The operator must configure the checklist and severity classification for the fleet. |
| SERVICE-DUE | Entered date or odometer threshold reached | Operator/manufacturer schedule, not a statutory service interval. Both thresholds are tested independently. |
| REGISTRATION | Entered registration date missing or expired | Internal reminder, not a live government registration lookup. |
| DRIVER-EVIDENCE | Active driver has missing class, missing date or expired licence date | Internal evidence prompt. No licence validity or vehicle-class entitlement verification is performed. |

The demo checklist has tyres, lights, visibility, body/couplings and fluid checks. It is an example, not an exhaustive inspection form. A qualified operator must review it, training, defect escalation, retention, jurisdiction and vehicle-specific checks before use. Add brake, load, emergency equipment and other checks where applicable. Drivers remain responsible for reporting defects during a journey.

The NZTA page announces inspection changes from 1 November 2026. Recheck the official requirements then; the program does not hard-code inspection frequency. Driver date checks use the current UTC date; vehicle checks use each asset's named timezone. The daily schedule assumes one recorded check per operating day, not one per shift. Configure a shift workflow where needed.

Repair entries preserve the technician, time and evidence reference. Closing a defect does not release a held vehicle. A named reviewer must record an administrative release after all critical defects are closed. That release is not a roadworthiness determination. Evidence storage and retention policies remain the operator's responsibility.
