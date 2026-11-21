# Approved capability audit — remaining work

The original audit counted 42 missing and 124 partial entries. Those are baseline counts, not the current completed/remaining count. Published batches do not mean the entire audit is complete.

## Decisions and boundaries

- Continue approved independent work without another Continue or GoDaddy sync. Hold changes locally until the agreed work is complete and checked; no intermediate GitHub uploads unless the user requests an urgent release (November 18 correction).
- Maps/live routing, payment-processor selection, shop .bak/live 123Pet validation, and Whiteboard layout remain deferred.
- Future Training/Sales Studio remains unauthorized under AGENTS.md; audit entries do not silently override that restriction.
- Sales breakdown basis approved: closed saved line totals after discounts, excluding tax, tips and prior-balance collection; no inferred employee attribution.
- Automatic confirmation requests default ON; stop when confirmed. Customer may choose several reminders (two days before, one day before, evening before, or morning of), each with a chosen time, and may add to calendar. Factory repeat confirmation days are 7, 5, 3, 2 and appointment morning; tenant configurable. Each includes tenant-editable no-show/same-day cancellation fee wording. Factory clocks: 9 AM on earlier days, 7 AM appointment morning. Customer attendance confirmation is separate from shop acceptance. Existing upcoming appointments are included by default; past request times are skipped. After a customer-confirmed appointment moves, ask the employee whether to request a new confirmation; factory-on prompt, tenant editable.

## Published batches

- b326565: platform PIN entry, export additions, staff email, SMS preferences, report CSV/reconciliation, print receipt.
- 264f434: employee time/tip/commission reports, stock at closing, single-location choices.

## Current continuation implemented and checked

- Online minimum booking notice and start-time spacing: defaults preserve 0 hours / 30 minutes. Settings search includes lead-time/interval terms. Slot offers and locked booking submission both enforce the current rule (audit 28/38).
- Household portal booking: multiple dogs/services on one ticket; existing tenant timing, ownership, eligibility, availability and quote checks retained (audit 31; live host verification remains).
- POS email invoice/receipt: explicit recipient review, saved-ticket revision validation, tenant messaging entitlement, recorded sending outcomes and repeat-request protection (audit 128/194; provider delivery remains unverified).
- Product/package/permitted-employee sales breakdowns and daily trend, using the approved closed-line basis. Component amounts counted once and no employee guessed. Existing reports unchanged (audit 2/7/18/199, not all advanced measures).
- Current customer balances/credits and unpaid saved tickets shown and exported separately; no invented due dates, aging policy or combined total (audit 6/135 remains partial for aging/collection workflows).

Verification: focused policy, availability, household, receipt sending/retries/access, sales/receivables and CSV tests passed. Production build passed. Local browser review used fictional responses: multi-dog selection/quote controls, receipt recipient review and accepted-but-not-delivered result, report sections, and booking defaults. No live email, SMS, customer database or GoDaddy deployment was used.

Remaining items include live verification of automatic messaging (approved ON; timing specified), the rest of the workflow engine, advanced reporting, document workflows, and other gaps listed below. Do not interpret this continuation as overall audit completion.

## Message templates and calendar continuation

- Customer Portal → Your appointments → Add to calendar downloads the customer’s own confirmed appointment, using the existing calendar-file formatter. Pending, cancelled and other-customer appointments are rejected.
- Settings → Communications → Message templates stores tenant-owned SMS/email wording with validated automatic details. Messaging inserts the selected template using the chosen customer and appointment; existing draft text is preserved and sending remains explicit.
- Local review caught and corrected a Settings search crash caused by the missing Device access breadcrumb registration. A regression checks every registered destination.
- Focused tests passed for template context, ownership, channel, missing details, calendar access, and existing business libraries. Production build passed. Local browser review verified template search/navigation and insertion preserving an existing draft, and the confirmed-appointment calendar control, using fictional API responses. No live messages were sent. Automatic reminder sending remains unfinished; templates do not claim to schedule or send reminders.

## Appointment reports continuation — checked

- Reports now includes counts by scheduled day/hour, saved status, service and actual assigned employee. Cancelled/no-show tickets are included in this separate breakdown; the original summary and sales calculations remain unchanged. Services/employees count each ticket once per group and clearly disclose overlapping groups.
- Print report opens a printable copy from the same report rows as CSV, retaining date/location, prior comparison, and offline snapshot information. Printing sends no messages and changes no business records.
- Focused report grouping, timezone, employee visibility, preserved summary, CSV and escaped-print tests passed. Production build passed; final print-format changes passed focused tests and type checking. Local browser verified cancelled/no-show counts and a fictional printable snapshot with readable dates and comparison columns. The in-app browser did not expose the new print window from the button; its rendered formatter output was checked separately. Actual printing/GoDaddy remain unverified. Audit 9 and printing portion of 19; fee/waiver analysis and scheduled delivery remain pending.

## Reused findings

- Inbound SMS STOP/START synchronization already exists in `app/api/integrations/twilio/route.ts` with signed provider callbacks, tenant/recipient checks, duplicate-message protection and audited phone preferences. Do not reimplement this portion of audit 49/110/121. Live provider verification and email-preference gaps remain distinct.

## Native automatic appointment messages — published 6bfc998

- GroomPro's production launcher now runs its own background scheduler; no Airo automation, external cron or open shop browser is required. The host must keep the production Node process running. Private internal authorization is generated automatically at startup, not entered by tenants.
- Approved factory schedule is enabled for existing upcoming appointments: 7/5/3/2 days before at 9 AM, appointment morning at 7 AM, in the shop time zone. Elapsed activation times and requests at/after the appointment are skipped. Initial acceptance/new-booking requests and customer-selected multiple reminders use the same dispatcher.
- Settings → Communications → Automatic appointment messages controls channels, schedule, fee wording, customer website address, reschedule prompt and shows the last scheduler check. Actual SMS/email provider setup remains required. Customer attendance remains separate from POS status and is available through its helpful hint.
- Confirmations, pending cancellations, changed times, access restrictions and changed recipients are rechecked before sending. Recorded operation IDs prevent duplicate sends across retries/restarts; uncertain provider results are not resent automatically. After downtime, only the latest due request of each kind is eligible, not a flood of older requests.
- Moving a customer-confirmed appointment asks Send new request / Move without sending / Cancel move. Explicit moves and indirect service-time changes share the transaction guard. Declining remains respected through later moves. Offline review offers the same send/skip decision bound to the exact conflicting times.
- Focused tests passed for native startup/loop, private endpoint, acceptance, planning, settings revisions, customer ownership, attendance/reschedule conflicts, indirect time changes, offline decision binding, SMS/email duplicate handling and existing affected booking/package flows. Final production build and type checks passed. Final browser review verified the website address on its own row, the runtime check and saving message rules using fictional responses.
- Fictional browser review verified separate attendance, multiple reminder choices and settings. No live customer messages or production data were used. Full hosted delivery remains unverified. The existing offline browser harness fails identically on the unchanged baseline; the older pet-items rendering assertion also expects superseded headings despite unchanged POS Items code. These are not claimed as passing integration checks.
- See `docs/native-appointment-messages.md` for operation and verification limits. This addresses appointment-specific portions of audit 78/82/83/84/85/86/101/107/108/109/119; it does not complete the general workflow engine or all audit gaps.

## Customer appointment communication preferences — published b7fbe54

- Automatic email/text dispatch now respects existing `appointmentEmail` / `appointmentSms` choices and invalid-address flags. Delivery helpers recheck those fields immediately before sending. Explicit staff messages and requested receipts retain their existing behavior.
- Customer Profile → Details exposes those existing fields with helpful explanations and field-search destinations. New-record defaults match the existing database; omitted values preserve imported preferences. No schema migration or reset of existing choices is involved.
- Updates use existing employee authorization, tenant scope and stale-record protection. Offline profile edits retain these ordinary boolean fields in the established queue.
- Focused dispatcher/delivery and preference validation/save tests passed, as did hint placement checks. Final production build passed. Fictional browser review verified imported email-off/invalid-email choices, a saved text preference and the adjacent highlighted hint. An older customer-display test harness has a missing profileDisplayPolicy dependency; that unchanged report/display path was not modified or claimed to pass.
- This advances audit 121; customer-facing email opt-out controls and live provider verification remain outstanding.

## Existing pet care fields — published b7fbe54

- Customer Profile → Pets → Edit pet now exposes the existing Medical conditions and Special behaviors fields, using the same names and saved records as intake and the customer portal. No duplicate note field or automatic interpretation of health/behavior information is introduced.
- Staff can view and edit the complete saved notes, with helpful hints and field-search destinations. Omitted fields remain untouched; unrelated grooming notes, ownership and vaccinations are not replaced.
- Focused validation and tenant/owner-scoped route tests passed. Final production build passed. Fictional browser review verified existing medical/behavior information, editing and reopening the saved pet note. This addresses the medical/behavior editing portion of audit 146, not every remaining pet/document workflow.

## Email delivery results — published 2033f29

- Signed Resend callbacks update the existing outbound communication record, scoped to the business, sender, recipient and provider message. Duplicate/older callbacks cannot regress the result, and an early delivery callback is preserved when the sending response arrives afterward.
- Messaging and Customer Profile → Communication History share plain-language explanations. Delivered means the recipient mail server accepted the email, not that the person read it. Customer preferences are never changed by this callback.
- No new dependencies, schema migration, live provider calls or customer messages. Provider endpoint configuration and a real hosted delivery remain unverified. Signed agreement attachment delivery uses a separate path and is not included in this batch. Audit 118 remains partial for those remaining paths.
- Twelve focused email/callback tests and the production build passed. Fictional browser review verified delivered/bounced explanations in Customer Profile → Communication History. Messaging uses the same formatter; its separate screen was not visually reviewed in this batch.
- Operation and verification limits: `docs/email-delivery-results.md`.

## Customer portal message choices — published bb54277

- Verified customers can view/change Appointment emails and Appointment texts in their portal. These are the existing Customer Profile fields, not duplicate preferences. Customer identity comes from the verified session, never a submitted customer ID.
- Customer updates cannot change invalid-contact flags, SMS consent on individual phones, other customers, balances or unrelated profile details. Existing automated delivery checks continue to enforce all restrictions; explicit requested receipts/agreements retain existing behavior.
- Stale saves ask customers to review saved choices. Late loading preserves input entered while the request was running. Changes are recorded in the existing customer audit history; no schema or provider changes.
- Ten focused route/service tests and the production build passed. Fictional browser review verified existing choices, saving/reopening email-off, and an adjacent highlighted helpful explanation. This advances audit 121; live hosted delivery remains unverified.

## Inventory stock history — published e73ec20

- Inventory → Stock history shows recorded opening counts, manual adjustments and ticket-close stock sales, including before/after quantities and shortages. It reuses the existing stock audit records and adds transactional count records to both product-editing routes. Existing checkout subtraction/shortage behavior is unchanged.
- The history window uses the shared movable/resizable window with saved placement, close control and a complete table before loading. History is paged and requires employee authorization plus inventory access. Platform owner names remain hidden from ordinary tenant viewers; customer IDs and ticket links are not exposed.
- Products remain business-wide, not per-location stock. Earlier unrecorded counts cannot be reconstructed. Historical cost of goods, purchasing and per-location stock are not implemented by this change.
- Thirteen focused history, product-save, catalog and existing checkout-stock checks passed. Final production build passed. Fictional browser review verified opening/sale rows and caught a stacking issue; the corrected history window was verified above the blue menu. No production inventory was changed. This advances audit 16, not the full inventory/accounting scope.

## Customer retention and cancellation analysis — published 61374dc

- Approved November 18: overdue factory interval is six weeks, tenant editable; cancellation/no-show date ranges use appointment dates (December 2 cancelled November 30 belongs to December).
- Reports → Customer retention shows active accessible customers across shared locations, last completed grooming, due date, next booked appointment, current overdue/no-history counts and first-time/returning visitors in the selected period. Closed tickets with pet-linked GROOM/BATH/PREP/DRY service lines count once; merchandise, fees and cancelled tickets do not restart the clock. No-history customers are not guessed overdue. Current overdue uses local calendar days, including daylight-saving boundaries; it is not a historical overdue reconstruction or full cohort analysis.
- Reports → Customer retention → Overdue after (weeks) defaults to six and allows owner/manager updates with validation, tenant isolation, stale-save checks and audit history. Blue-menu search includes the field. The preference is included in tenant exports. Changes do not schedule messages, change appointments or mark customers inactive.
- Reports → Cancellations and no-shows uses the selected location and saved appointment date, retaining pending bookings separately. Rates exclude drafts and unaccepted requests. Fee processing can save a ticket as Cancelled, so recorded status and assessed fees remain separate; fee records alone are not treated as proof of a no-show. Waiver decisions are deduplicated by request, and assessed fees are not claimed as collected payments. Earlier cancelled dates after subsequent moves are not reconstructed.
- CSV and printable report share the same data and basis descriptions; existing sales/reconciliation calculations are unchanged. Seventeen focused calculation, authorization, isolation, stale-save, existing report, CSV and print checks passed. Final production build passed. Fictional browser review verified the six-week default, saving eight weeks, overdue/no-history/next-booking rows, cancellation appointment dates and previous-period columns. No production records were changed; live hosted operation remains unverified. This advances audit 10/11/153; it does not complete every remaining audit capability.

## Audit backlog

Each entry below retains the original gap until explicitly reconciled with tested implementation. Some gaps have been partly addressed in the published batches above; do not reimplement those portions.

| ID | Capability | Original gap to reconcile |
|---|---|---|
| 2 | Sales by service, product, membership, package, employee, and location | Product/package/VIP revenue and employee revenue breakdowns are incomplete. |
| 3 | Sales tax collected and tax liability reports | Reports do not expose collected-tax/liability totals or treatment of partial payments and reversals. |
| 4 | Gross sales, net sales, refunds, voids, discounts, and adjustments | No gross-to-net/refund/void/adjustment reconciliation. Account-balance collection lines are included in line totals. |
| 5 | Payment method and payment processing reconciliation | No processor payout, fee, settlement or bank reconciliation. |
| 6 | Outstanding balances and accounts receivable | No consolidated receivables/aging report. |
| 7 | Employee productivity and revenue per employee | No unified employee revenue, utilization or productivity dashboard. |
| 8 | Employee commissions, payroll-related reports, and tips | Employee-level tip/payroll export and integrated payroll report are incomplete. |
| 9 | Appointment volume by day, time, employee, service, and status | No full breakdown by time/employee/service/status; cancelled tickets are excluded from source query. |
| 10 | Cancellation and no-show analysis | No dedicated cancellation/no-show rates or fee/waiver analysis; cancelled visits excluded from Report query. |
| 11 | Customer retention, repeat visits, and inactive customers | No retention cohorts, repeat-visit rates or lapsed-customer report. |
| 12 | Customer lifetime value and highest-value customers | Lifetime value/highest-value customer report. |
| 13 | Membership revenue, enrollment, cancellations, and retention | Recurring revenue, cohort retention and true historical status analysis are absent. |
| 14 | Package sales, usage, and outstanding balances | No general prepaid-package unit ledger, liability or package revenue report. |
| 15 | Gift card sales, redemption, and liabilities | Gift card lifecycle and financial reports. |
| 16 | Inventory, product sales, and cost of goods | No sale-driven stock movement or historical COGS report found. |
| 18 | Graphical dashboards and visual reporting | No graphical trend dashboard/charts. |
| 19 | Report filtering, exporting, printing, and scheduled delivery | No dedicated report export/print layout/scheduled delivery found. |
| 20 | Multi-location reporting, where applicable | No consolidated shop comparison; mixed scope can be misunderstood. |
| 21 | GroomPro-hosted booking pages branded for each grooming business | Full tenant logo/theme/domain customization is not demonstrated. |
| 23 | Embeddable website booking widgets | Embedded booking widget and host integration contract. |
| 24 | Customer portal for existing and new customers | No full cross-device live-host verification; multi-pet online checkout and customer payment remain incomplete. |
| 28 | Tenant-controlled appointment availability and booking rules | No clear connection from older category rules to the new portal; slot spacing is fixed at 30 minutes. |
| 29 | Employee availability and service assignment | No employee/service qualification rule in portal; shared staff assignments are richer than portal choices. |
| 31 | Multi-pet and household booking | One online household transaction covering multiple dogs. |
| 34 | Current rabies vaccination requirements and other required documents | No complete online rabies/document upload, review and enforcement workflow found. |
| 36 | Deposits and authorized cards on file | No portal deposit/consent/payment collection flow with a selected provider. |
| 37 | Cancellation, rescheduling, and no-show policies | Uniform fee behavior for all staff rescheduling paths and provider charges is not demonstrated. |
| 38 | Booking lead-time and advance-booking restrictions | No separate minimum booking lead-time control; 30-minute increments are fixed. |
| 39 | Customer waitlists and available-slot notifications | Waitlist enrollment, matching and notification handling. |
| 40 | Booking abandonment tracking and recovery | Abandonment detection and recovery. |
| 41 | Booking conversion and customer acquisition reporting | No booking funnel/conversion/source attribution or recovered-revenue report. |
| 42 | Prevention of conflicting appointments | Full concurrent portal/staff race verification is absent; whole-ticket blocking is stricter than some salon drop-off patterns. |
| 43 | Recognize when a customer begins but does not complete an online booking | Session-stage capture and abandonment classification. |
| 44 | Identify the point where the booking was abandoned | Session-stage capture and abandonment classification. |
| 45 | Preserve available customer, pet, service, and appointment information appropriately | Resumable online booking draft, distinct from staff POS drafts. |
| 46 | Notify authorized staff of abandoned bookings | Staff visibility and assignment. |
| 47 | Support automated or manually initiated follow-ups | No recovery-specific follow-up workflow or automation. |
| 48 | Track recovered appointments and associated revenue | Recovered appointments/revenue tracking. |
| 49 | Respect customer communication consent and privacy requirements | No abandonment-specific retention/consent controls; inbound STOP is not mirrored to local preferences. |
| 50 | Appointment created | No shared durable event dispatch or configurable automation triggers. |
| 51 | Appointment confirmed | No shared durable event dispatch or configurable automation triggers. |
| 53 | Appointment rescheduled or canceled | No shared durable event dispatch or configurable automation triggers. |
| 54 | Customer checked in | No shared durable event dispatch or configurable automation triggers. |
| 55 | Pet ready for pickup | No shared durable event dispatch or configurable automation triggers. |
| 56 | Appointment completed | No shared durable event dispatch or configurable automation triggers. |
| 57 | Customer did not arrive | No shared durable event dispatch or configurable automation triggers. |
| 58 | Customer started but abandoned online booking | Abandonment event and timeout. |
| 59 | Customer has not returned within a configured period | No configurable lapse/rebooking eligibility event or periodic evaluation. |
| 60 | Pet becomes eligible for rebooking | No configurable lapse/rebooking eligibility event or periodic evaluation. |
| 61 | Membership enrollment or cancellation | No general membership event subscriptions. |
| 62 | Membership payment successfully processed or failed | No verified recurring-payment runner or success/failure workflow. |
| 63 | Package approaching expiration | Reliable package-expiry/exhaustion events. |
| 64 | Package balance approaching zero | Reliable package-expiry/exhaustion events. |
| 65 | Customer birthday or pet birthday | No birthday schedule or messaging workflow. |
| 66 | Required documents approaching expiration | No expiry evaluation/reminder engine. |
| 67 | Outstanding invoice or unpaid balance | No due-balance automation trigger or reminder schedule. |
| 68 | Employee or manager follow-up required | Task ownership, due dates and completion events. |
| 69 | Customer confirmed or has not confirmed | No reusable condition evaluator for workflows. |
| 70 | Customer responded or did not respond | No workflow reply condition or structured confirmation response. |
| 71 | Appointment remains active | No reusable condition evaluator for workflows. |
| 72 | Customer is an active VIP member | No reusable condition evaluator for workflows. |
| 73 | Payment completed or failed | No reusable condition evaluator for workflows. |
| 74 | Pet is eligible for a particular service or program | No agreed general pet-eligibility rule for automation. |
| 75 | Customer has an upcoming appointment | No reusable condition evaluator for workflows. |
| 76 | Follow-up has already been completed | Completion and staff-intervention conditions. |
| 77 | Employee has manually intervened | Completion and staff-intervention conditions. |
| 78 | Immediate actions | No configurable immediate workflow action dispatcher. |
| 82 | Time-zone awareness | No automation-specific daylight-saving and delivery-window scheduling. |
| 83 | Cancellation of obsolete scheduled actions | No generalized invalidation of obsolete scheduled messages/actions. |
| 84 | Prevention of duplicate or contradictory communications | No workflow-wide event/run/action uniqueness. |
| 85 | SMS notifications | No configurable automation SMS action. |
| 86 | Email notifications | A shared operational email sender and automation action. |
| 87 | Internal staff notifications | Assigned tasks, notification delivery and completion tracking. |
| 88 | Tasks and follow-up assignments | Assigned tasks, notification delivery and completion tracking. |
| 89 | Customer account updates | No configurable, audited automation account action. |
| 90 | Appointment status updates where appropriate | No configurable automation action with lifecycle protections. |
| 91 | Automated rebooking invitations | No event-driven rebooking invitation. |
| 92 | Membership-related follow-ups | No membership follow-up sequence. |
| 93 | Payment reminders | No payment reminder workflow or integrated payment link. |
| 94 | Customer retention messages | Eligibility, timing and suppression rules. |
| 98 | Role-based permissions | No workflow-specific edit/publish/run permissions. |
| 99 | Automation history and delivery logs | No end-to-end automation execution log. |
| 100 | Failure handling and retry behavior | No generalized retry/dead-letter workflow. |
| 101 | Message personalization using actual customer and pet information | No shared typed workflow template variables and validation. |
| 104 | Reporting on automation effectiveness | Effectiveness reporting. |
| 107 | Appointment confirmations | No automatic customer confirmation message/reply-to-confirm flow found. |
| 108 | Multiple reminder schedules | Configurable SMS/email appointment reminders. |
| 109 | SMS and email reminders | Configurable SMS/email appointment reminders. |
| 110 | Two-way messaging | No two-way email inbox; local STOP preference synchronization is missing. |
| 111 | Customized message templates | No general reusable operational message template library. |
| 112 | Customer and pet information placeholders | No unified validated placeholder catalog. |
| 113 | Automated appointment status notifications | Approved status-to-message rules. |
| 114 | Ready-for-pickup notifications | No automatic ready-for-pickup message on status change. |
| 115 | Appointment changes and cancellation notifications | No complete automatic change/cancellation notification sequence. |
| 116 | Rebooking reminders | No scheduled rebooking reminder. |
| 118 | Message delivery status | Ordinary email is not delivered; no unified email delivery events. |
| 119 | Confirmation tracking | No structured reply confirmation or confirmation-source timeline. |
| 120 | Manager follow-up notifications | No general manager follow-up inbox/escalation. |
| 121 | Customer opt-in and opt-out management | Inbound STOP/START does not update local preferences; email preference enforcement is incomplete. |
| 124 | Membership and package purchases | General prepaid-package balances and automated recurring collection are absent. |
| 125 | Integrated credit and debit card processing | No complete tenant-safe integrated card flow or verified provider operation. |
| 126 | Contactless and mobile payment options | Terminal pairing, payment authorization and settlement. |
| 127 | Secure card-on-file payments | No fully verified enrollment/consent/provider lifecycle. |
| 128 | Digital invoices and receipts | No complete invoice/receipt generation and delivery workflow found. |
| 129 | Payment links | Hosted payment link creation and verified callback posting. |
| 130 | Deposits and prepaid balances | No dedicated reservation deposit or prepaid allocation/refund policy. |
| 132 | Discounts, promotions, and credits | No general promotional campaign/code engine demonstrated. |
| 134 | Refunds, voids, and adjustments | No end-to-end refund/void with payment reversal, inventory and accounting effects. |
| 135 | Outstanding invoices | No consolidated outstanding-invoice/aging collection workflow. |
| 136 | Recurring membership billing | No verified recurring charge worker/provider webhook lifecycle. |
| 137 | Failed-payment handling | No retry/dunning/customer recovery workflow. |
| 138 | Gift cards and stored-value liabilities | Issuance, secure lookup, redemption, balance and liability ledger. |
| 139 | Payment transaction reporting | No full transaction/refund/fee/payout report. |
| 141 | Financial reconciliation | No settlement/bank/reversal reconciliation. |
| 146 | Breed, size, coat, and behavior information | Not every medical/coat/behavior schema field has a complete visible editing workflow. |
| 148 | Photos and before-and-after comparisons | No full before/after photo timeline/comparison flow found. |
| 149 | Customer-facing grooming report cards | No comprehensive photo-rich delivered report-card document/history workflow. |
| 151 | Grooming progress tracking | No fully mapped seven-step process or complete per-stage timing established. |
| 152 | Vaccination and document tracking | Complete upload/verification/editing and required-document booking checks are incomplete. |
| 153 | Customer retention information | No retention/cohort/lapse summary for staff. |
| 154 | Customer tags and segmentation | Reusable tags, saved audiences and access rules. |
| 155 | Membership and package history | General prepaid-package balance/history is absent. |
| 157 | Customer data import and export | New clock/tip-allocation/portal-policy setting keys are omitted from the export allowlist; external photo URLs are not bundled; .bak/live sync not validated. |
| 162 | Employee performance reports | No consolidated employee performance/payroll report. |
| 163 | Service duration tracking | No complete actual per-service/per-stage timer. |
| 164 | Commission and tip reporting | Combined employee earnings export/report incomplete. |
| 165 | Internal task management | Assignments, due dates, completion and escalation. |
| 166 | Grooming workflow tracking | The requested seven-step process is not unambiguously mapped. |
| 167 | Employee training and quizzes | Training content, completion and feedback records. |
| 168 | Coaching and performance feedback | Training content, completion and feedback records. |
| 169 | Manager notifications | No proactive manager notification/task hub. |
| 170 | Multi-location staffing, where applicable | Cross-location staffing, travel and simultaneous-booking rules are not fully established. |
| 171 | Map-based appointment calendar | Live key/provider operation and full map integration remain deferred/unverified. |
| 172 | Route optimization by travel time and distance | Traffic/time-aware routing and ETA windows are missing. |
| 176 | Travel-time buffers between appointments | Traffic-aware travel feasibility and buffers. |
| 179 | Recurring neighborhood routes | Recurring route templates/cycles. |
| 180 | Multi-vehicle scheduling | No explicit multi-vehicle route plan/assignment model. |
| 181 | Vehicle and employee assignments | No explicit multi-vehicle route plan/assignment model. |
| 182 | Automatic route suggestions | Suggested feasible slots/stops based on route. |
| 183 | Cancellations and route recalculation | No persisted route replan/notification workflow for cancellations. |
| 184 | Nearby customers eligible for last-minute openings | Nearby eligible customer queue and consented outreach. |
| 185 | Emergency rescheduling when vehicles become unavailable | No complete vehicle emergency reassignment/reroute workflow. |
| 187 | Daily route overview | No fully persisted daily mobile route lifecycle. |
| 189 | On-my-way notifications | No dedicated on-the-way action linked to route/ETA. |
| 191 | Customer communication while traveling | No route-context communication shortcut/ETA integration. |
| 193 | On-site payment collection | No verified mobile terminal/card collection integration. |
| 194 | Mobile invoices and receipts | Mobile invoice/receipt generation and delivery. |
| 195 | Offline access to essential information | Not a complete local database replica; uncached data/providers unavailable; fresh reports do not recompute all queued work. |
| 196 | Vehicle-related notes and maintenance tracking | Maintenance, downtime and service reminders. |
| 197 | Revenue per route | Route/vehicle revenue reports. |
| 198 | Revenue per vehicle | Route/vehicle revenue reports. |
| 199 | Revenue per employee | Employee revenue attribution is not a complete report. |
| 200 | Mileage and travel time | Persisted actual mileage and travel-time reporting. |
| 201 | Grooming time versus driving time | Reliable actual grooming-versus-driving measure. |
| 202 | Estimated operating costs | Mobile operating-cost attribution. |
| 203 | Appointment profitability | Appointment/route net profitability. |
| 204 | Route profitability | Appointment/route net profitability. |
| 206 | Responsive phone and tablet interfaces | Every form/device/keyboard state has not been visually verified; full paper-form compliance is not proven. |
| 209 | Optional feature modules | Live paid provisioning/billing integration and all combinations are unverified. |
| 212 | Clear, human-friendly field descriptions and hints | Universal wording accuracy/coverage and no-overlap placement on all devices not fully verified. |
| 213 | Simple onboarding | Provider setup remains manual; first-use end-to-end hosting experience is unverified. |
| 214 | Customer and pet data migration | Live 123Pet connector/package mapping and shop .bak restoration still need representative validation. |
| 215 | System reliability | Live GoDaddy/database/provider/load reliability is not established. |
| 216 | Data backup and recovery | Not a complete database disaster-recovery system; host backups/retention/restore are unverified, export omits newer operational setting records. |
| 218 | Multi-location scalability | Large multi-location concurrency and consolidated analytics unverified; staffing rules need decisions. |
| 219 | Transparent subscription and integration costs | Actual hosting/provider/processing costs and complete customer-facing cost disclosure are not verified. |

## November 18 decisions — implementation in progress, not published
- Unfinished online bookings: flag after 30 minutes of inactivity by default; tenant editable.
- Ready-for-pickup, appointment change/cancellation, and rebooking messages: factory ON. Preserve consent and tenant settings.
- Internal staff task list is approved: owners/managers assign by default; tenants may allow any employee to assign coworkers. This means a separate employee to-do list, not appointment/service assignments.
- Recorded lifetime customer sales report is local and undergoing verification; no publication yet.

### Local continuation — not published
- Reports → Recorded lifetime customer sales: ranked historical closed-line sales by selected location, customer filter, CSV/print; excludes tax/tips/prior-balance lines. Not predicted lifetime value, profit, or inferred refunds. Nine calculation/route checks passed; production build passed; fictional browser review verified ranking and filtering. Large real-data volume remains unverified.
- Unfinished online booking follow-up: verified customer booking-field activity, server timestamps, tenant-editable 30-minute inactivity default, separate list under Request; successful submission closes that attempt and delayed activity cannot reopen it. No slot reservation or automatic follow-up messages. Focused policy/portal tests and production build passed; fictional browser list reviewed. Staff follow-up completion is now available. Recovery drafts, stage details and recovered-revenue attribution are still unfinished.
- No production database changes or external messages were made. GitHub upload remains on hold.

- Rebooking decision: factory six weeks after the last completed grooming visit when no future appointment exists; use the tenant retention interval after it changes. New lifecycle message categories are local/in verification, not published. Resolved: declining a new confirmation does not suppress the separate automatic change notice.

### Local automatic-message continuation (not published)
- Added factory-on pickup, date/time-change/cancellation, and rebooking categories with editable wording and independent tenant switches. Shared native dispatcher preserves contact preferences, tenant access, provider guards, stable operation IDs and dispatch-time eligibility checks. No live sends performed.
- Rebooking uses latest qualifying closed grooming, default six-week tenant retention interval, excludes future bookings/requests and transferred/inactive dogs. Bounded SQL candidates avoid repeatedly dispatch-checking every old ticket; SQL semantics checked with an in-memory database, not live MySQL.
- New lifecycle activation boundary preserves existing confirmation activation. Old pickup/change/cancellation events are not replayed on initial rollout. Actual cancellation audit evidence is required; a late request or fee alone is not a cancellation notification.
- Focused lifecycle/store/dispatcher tests passed; build and local fictional settings save/toggle review passed. Candidate-query optimization and small hint/copy changes followed that build; include them in final release verification.
- The user resolved the change-notice question and approved staff tasks; see latest decisions below.

- Automatic message delivery report added locally: selected-location automatic outbound records by creation date, current delivery results kept distinct, CSV/print supported. Twelve focused query/count/export/report-route checks passed. Visual review and final build for this newest section remain pending. This does not claim conversion attribution or provider-confirmed reads.

- Local development review verified Automatic message delivery with delivered, queued and unknown outcomes, and staff completing an unfinished-booking follow-up. Latest type check passed before the final follow-up-action additions; final release verification still required. No GitHub publication.

### Latest user decisions and staff-task work
- Approved: still send an automatic date/time-change notice when staff decline a new confirmation. Confirmation requests and change notices remain separate. Previous conflict is resolved.
- Internal staff tasks are now approved, including Customer Service Associates and sales employees as assignees. Factory assignment permission: owners/managers; tenant may allow any employee to assign coworkers.
- Staff task list/editor, due dates, completion/reopening, assignment policy, audited revisions and existing offline queue integration are local. Five focused task permission/isolation/conflict/offline checks passed. UI review and full final release verification remain pending. Escalation/notification delivery is not yet claimed complete.

- Staff-task browser review: a task assigned to a Customer Service Associate saved its notes and due date after native date editing. The date-fill automation did not initially commit a date; native keyboard editing did. Editor errors now remain inside the editor. Production release verification and remaining audit work are not complete.

- Task-assignment policy verification: six focused checks passed, including owner/manager-only policy edits, tenant opt-in for coworker assignment, stale-policy protection, tenant isolation and offline task revision rules. Type checking and diff whitespace checks passed. Fictional browser review verified completed tasks remain available with Reopen and retain their assigned employee, notes and due date. These results do not complete the overall audit; no publication performed.

## Continued November 18 — local only; publication prohibited by latest request
- Unfinished portal booking now records the last stage and saves selected dogs/services, preferred date/time without expiry. Verified customers choose Continue where you left off; current availability/prices are rechecked. Drafts remain tenant/customer/location scoped, transferred pets are omitted, concurrent-device revisions prevent overwriting newer choices. Successful booking retains its choices linked to the saved ticket and stops offering it as unfinished. Eight focused store/validation tests and portal ownership checks passed; fictional browser restored Gizmo/service/date and fetched fresh times. Recovered-revenue reporting is still unfinished.
- Overdue staff tasks: visible to assignee/managers in GroomPro with a floating notification and link to staff tasks; completed tasks are excluded. Deadline uses the task's originating shop time zone. No customer messages or Whiteboard layout changes. Seven permission/time-zone/offline checks and fictional manager notification review passed.
- Inventory report: business-wide current counts, current recorded cost value, retail value, inactive products and zero-cost warning; CSV/print use the same snapshot. Fictional report/filter review passed. Separate merchandise cost report now uses costs snapshotted transactionally at ticket closing; older/ambiguous costs stay Cost not recorded. Fifteen focused inventory/checkout/report tests passed. Historical costing UI and final build still pending.
- Waitlist decision: staff choose whom to contact; no automatic customer offers. Resolved: customers and staff may enroll; matches include every employee/asset enabled for online booking. Factory employees remain off and assets on, with tenant overrides. Product unit-cost snapshot at closing approved.
- Added saved price/discount reconciliation from existing closed-line values; missing price detail and saved differences stay separate, with no inferred refunds/voids. Verification in progress.

### Further local continuation — no publication
- Waitlist enrollment, staff edits/contact recording, native bounded opening checks, in-app opening notices and linking a fulfilled request to an existing appointment are implemented locally. Both portal customers and staff may enroll. Matching reuses current online availability, full duration, schedule overrides, time blocks and existing bookings; staff choose whom to contact. No automatic offer, reservation or customer message. Closed entry history is retained. Customer/tenant/shop access and stale revisions are enforced.
- Waitlist focused checks: six store/action tests, six online-resource availability tests, two staff-route access tests, three native-runner tests and existing scheduler/private-endpoint tests passed. Fictional browser review verified customer joining, staff editing/contact recording and linking a saved appointment. Latest UI hints and final release build are not yet fully reverified. Hosted scheduling remains unverified.
- Product cost and resumed-booking report implementations passed the earlier November 18 production build. Subsequent waitlist links, hints, receivables and conversion report additions require the next build. Historical cost UI review remains pending.
- Resumed booking revenue is now implemented, superseding the earlier unfinished notes: recorded linked tickets, submission versus original closing date, saved net lines excluding prior balances/tax/tips. Tracked booking conversion adds start-date cohorts, current submission results and last recorded unfinished stage; it does not count anonymous website visitors or claim causal outreach attribution. Three calculation tests passed. Customer-sharing filters apply before aggregating attempt records.
- User clarified outstanding balances: balance due carries into the next appointment and is paid at checkout; no separate overdue deadline. Existing checkout carries the balance and requires payment before closing. Reports now show the saved account-balance line within unpaid ticket totals and next accepted appointment at the selected location, without altering balances or charging fees. Three calculation checks and existing exports passed. This does not claim a separate aging/fee policy.
- Remaining audit work remains open; these entries do not mean all 42 missing / 124 partial baseline items are complete. No GitHub upload, live database edits or external messages performed.

### Vaccination records and documents — local, not published
- Factory rule accepts booking and flags missing/expired vaccination records for staff review. Tenant may require current records for online booking or disable the check; staff appointments are not automatically cancelled. Rabies is the initial required vaccine from audit item 34; names are tenant editable.
- Shared pet editor now adds/edits dated vaccinations with conflict detection, retry-safe creation, audit history, preserved source links and no guessed expiration. Records follow the pet after ownership transfer.
- Verified portal customers and staff may upload PDF/JPEG/PNG vaccination documents (5 MB limit). Files remain in the tenant database, downloaded only through authenticated access; uploads do not silently approve vaccination dates. Staff can record several vaccinations from one reviewed source document. Prior-family uploads are not exposed to a new family after pet transfer.
- Staff Request view flags booked pets with missing/expired records over the next 30 days. Blue-menu search reaches and highlights Vaccinations or Vaccination documents within the selected customer/pet; Search remains open.
- Document metadata and content are included in portable tenant exports. Fifteen focused vaccination/export checks and two review-route checks passed; earlier document/privacy and portal checks passed. Production build passed before the final search registration; subsequent type checking passed. Fictional browser review verified uploading, staff review, saved dates, record count refresh and search highlighting.
- Not verified on GoDaddy or a live database. Uploads require a connection; general non-vaccination documents, expiry reminder scheduling and full audit completion remain open. No external messages or publication.
- Gift cards: user approved anyone with the card code redeeming its balance. Activation/tax and preserving manual legacy-card payment behavior still need decisions before checkout changes.

### Gift cards and website booking links — implementation in progress
- Approved gift card rules: anyone with the code can redeem; no expiry; purchase is untaxed; activate only after its paid POS ticket closes. Every new gift-card payment, including additional tips, must supply a code; no manual legacy-card bypass. Historical imported payments are not rewritten.
- Local gift-card ledger, secure random codes, tenant-scoped balance lookup, paid-close activation, locked redemption, POS menu/editor and gift-card reporting are in progress. Gift-card purchase lines are excluded from new service/product sales and merchandise stock/cost; ordinary purchases at redemption keep existing tax behavior. Issued value and redemption are separately reported, with masked current business-wide balances.
- Nine core/checkout/tip tests passed, including code-required tip rollback, paid-close validation, pending-card rejection, overspending and idempotent redemption. Twenty-eight focused gift/report/export/inventory checks passed. Latest type checking passed before final minor UI adjustments. Fictional browser verified a $50 untaxed purchase remains unusable before closing and activates with $50 balance after paid closing. Full route/concurrency, gift-only draft and browser redemption checks remain in progress; no live financial transactions.
- Website booking link and embeddable portal code now appear alongside portal settings. Both require a selected shop and reuse the existing portal; no duplicate booking logic. Three link/escaping/host-validation checks passed. Fictional browser verified copy of the shop-specific link. Embedded rendering and hosted website-builder compatibility remain unverified.
- Vaccination reminder decision: default eight weeks before expiration, tenant editable, for all active customers regardless of upcoming appointments. Sending implementation remains pending.

### Vaccination reminder continuation — November 19, local only
- Factory ON, eight weeks before expiration at 9 AM in the customer's home-shop time zone; includes existing records already inside the window, for all active customers and active pets without requiring an appointment. Tenant can edit weeks, time and wording. Existing contact preferences and configured delivery channels apply.
- Native server scheduler now pages vaccination records independently of appointment messages and waitlist checks. Current ownership, active records, renewed vaccinations, tenant access and current policy are rechecked before sending. A recorded copy is not resent after retries or restarts. Missing home shop in a multi-location business is reported instead of guessed.
- Settings → Communications → Automatic appointment messages shows vaccination controls and the last vaccination check. Expired records remain in the review workflow; this reminder describes upcoming expiration only.
- Twenty-four focused scheduler, reminder-policy, dispatcher, email and existing policy tests passed. Type checking passed. Fictional browser review verified the eight-week/9 AM controls; message-width refinement followed review. No real SMS/email sent. Host delivery and final release build remain unverified; overall audit remains unfinished and publication is held.
- Gift-card balance lookup was verified in the fictional browser. Review exposed help covering the adjacent action and a narrow code field; the new gift-card screen now places the action below the field and provides room for the full code. Final visual recheck remains.

### November 19 additions — still local, not overall completion
- Production build passed after gift-card purchase/redemption and vaccination reminder integration. Later gift delivery, review requests and prepaid offers need the next build.
- Gift purchase operation replay and gift checkout transaction checks passed: empty gift-only draft uses one saved ticket; changed retry intents are rejected; invalid codes roll payments back; concurrent payment attempts cannot exceed the locked ticket balance. Actual MySQL concurrency remains unverified. Gift-card audit records now use the established TICKET audit entity with the gift-card ID in details; a test validates the Prisma enum rather than accepting an unsupported entity.
- Printable gift-card document added and visually reviewed with fictional content. Email permits a separately entered recipient without creating a customer or changing purchaser contact details; purchaser remains the communication-history owner. Recipient, saved card revision, purchase scope and messaging permissions are checked; repeat IDs cannot send to a different address. Focused email tests passed. Email UI and provider delivery remain unverified.
- All automated wording remains tenant editable. Review request at ticket closing added to existing native lifecycle messaging with editable wording and HTTPS review link. Saving the link establishes a separate activation boundary; old closed visits are not backfilled. Policy/store/lifecycle/dispatcher tests passed; new review UI and live sending remain unverified.
- Website booking embed displayed the portal sign-in form within a second local test website; hosted third-party website-builder/cookie behavior remains unverified.
- Approved prepaid rules: each tenant creates offers with its own covered service/package, visit count and total price (six Self-Service visits priced as five; fourteen Full Wash visits priced as ten). Factory FAMILY sharing, optional PET restriction; no expiration by default, configurable expiry; tax at purchase; visits deducted at closing; tenant chooses commission basis per offer. During transfer staff choose whether a dog-restricted remaining package stays with purchaser or follows dog.
- Prepaid offer editor and revision-protected tenant settings API are started. Purchase ledger, redemption, commission integration, ownership-transfer choice, reports and verification are not yet complete.

### Prepaid checkout and transfers — November 19, local only
- Prepaid purchase/paid-close activation, service/package visit application/removal, closing-only deduction and tenant-selected commission basis are connected to POS. Location service price overrides are respected for regular-price commissions; prepaid commission allocations preserve every cent. Purchase terms are snapshotted, not rewritten by later offer edits.
- Latest user decision: when a one-dog package stays with its current family after transfer, leave its unused visits unassigned until staff choose another active dog from that family. Transfer now requires a separate follow/keep decision for each eligible package and rejects stale balances. Existing tickets/history retain their original customer.
- Added later dog assignment with revision and ownership checks, prepaid purchase/use history, report and CSV with current business-wide unused balances. Expired balances remain visible with expiration dates; no inferred forfeiture or refund.
- Focused transfer, prepaid balance/commission, checkout stock-preservation, report/export and report-permission checks passed. Type checking passed. Fictional UI verified entering, saving and reopening six Self-Service visits at $100, retaining family sharing/no expiry and chosen commission basis. Corrected cents conversion before release.
- Transfer/assignment UI, full prepaid checkout browser workflow, actual database concurrency, hosted behavior and final production build remain unverified. Gift email/review UI checks and wider audit work remain open. No GitHub upload.
- Asked for factory prepaid expiry/low-balance reminder thresholds; pending answer. Continue independent work while awaiting it.

- Prepaid reminder decision resolved: factory OFF; tenant chooses their own thresholds. Added optional remaining-visit and days-before-expiration thresholds, editable time/wording, and an independent native scheduler cursor. Existing contact preferences, current ownership and recorded-copy retry protection apply. Policy/dispatcher/endpoint/scheduler checks passed; no live messages. UI and final build after these newest changes remain pending.
- Production build passed for prepaid checkout/report/transfer changes before the final reminder additions. Transfer UI was reviewed with fictional records and the keep-with-family/unassigned choice visible; actual transfer rules are covered by focused tests. Package tax weighting now respects location service prices as well as regular-price commission; its additional test is still pending.

- Added and passed shop-price mixed-tax purchase coverage and native prepaid pagination checks; latest type check passed. Prepaid reminder errors are recorded for Settings review; optional expiration wording no longer blocks messages for no-expiry packages. Current rule is one recorded reminder per package/customer/reason/channel, with a combined expiration/balance condition sent once rather than twice in the same check.
- Clarification requested for birthday-message audience/defaults and the seven-step grooming workflow. Current grooming stages remain unchanged while awaiting that definition.

### Grooming photo history — local continuation, incomplete
- Added dated JPEG/PNG staff uploads in the tenant database, before/after/other categorization, captions, same-date comparison and original-ticket links. Shared photo component is mounted in the pet editor and POS Report Card; POS binds uploads to a ticket containing that dog. No public file URLs or automatic customer delivery.
- Tenant/pet access, ticket membership, payload limits, file signatures, real calendar dates, changed retry rejection and metadata-only lists have focused tests. Existing vaccination-document tests still pass. Photo metadata/files are included in tenant export. Latest type checking passed.
- Browser upload/comparison review, photo report-card customer delivery and final build remain pending. This does not complete the photo/report-card audit items or broader audit.

- Production build passed after prepaid reminders were integrated (before grooming-photo additions). Current photo work remains local and needs visual verification. A saved, customer-reviewed report-card snapshot with selected photos is the next delivery step; existing SMS report-card behavior remains in place.

### Customer photo report-card delivery — local, verification ongoing
- Added explicitly saved customer report-card copies using the current message and staff-selected ticket photos. Each save retains a historical version; current and historical copies can be printed. The portal lists the saved card on its original customer's appointment, including after dog ownership changes. No prior-family ticket access is granted to a new owner.
- Email is an explicit staff action to the reviewed customer email and sends a scoped sign-in portal link. Existing SMS report-card behavior remains available. Sending respects messaging entitlement and saved revision/recipient checks with a stable retry ID; no live email was sent.
- Core save/history/photo ownership/escaping checks and email route authorization/revision/recipient tests passed. Existing portal access and booking tests passed. Type checking passed. UI review, provider delivery and final build remain unverified; overall audit remains open.

### Birthday messages and seven-stage decisions — November 19, local
- Birthday audience: customers and pets, both factory ON. Approved factory time 08:00 in the customer home-shop time zone. February 29 birthdays use March 1 in non-leap years; tenant may choose February 28 instead. Both wording templates and toggles are editable.
- Added native birthday scan with independent pagination, per-year/subject/channel retry protection, current owner recheck, active customer/pet checks and existing contact preferences. No live messages. Policy, date handling, dispatcher and independent scheduler tests passed; type check passed before the final profile fields.
- Added optional Birthday date inputs to shared customer and pet editors, preserving omitted dates and validating real calendar dates. UI and final production build remain pending.
- Report-card UI save verified against fictional API records; saved version appears and print/email actions become available. Expanded layout reviewed. Small saved window leaves a very short scrolling content area; sizing behavior needs focused review. No real email sent.
- Seven-stage sequence supplied by user: Acclimation Station, Pre-Bath Prep, Chillax Time, Splash Zone, Fluff ’n’ Puff, Chillax Time 2, Hairdo Deluxe. Highest subscription level initially; developers can include in any plan. Existing plans have no highest-level designation; clarification pending on identifying that plan. Do not impose Rubber Doggies-specific washing/no-kennel-dryer policies on other tenants or alter scheduling/pay.

- Production build passed after customer report-card/photo and birthday additions (before seven-stage progress additions). Birthday settings visually verified with both audiences on, 08:00, March 1 and editable messages. Wider text boxes added following review.
- Added initial seven-stage per-dog progress API and POS Notes controls, with separate recorded start/completion times, tenant/shop/ticket scope, stale-update rejection and audit history. It does not change booked time, price, actual service assignments or pay. Focused sequence/timing/export checks and type checking passed. Plan registration added; developer can include this feature in any created plan. Highest-plan default, workflow customization, full UI review and final build remain incomplete.
- User reports plan creation not discoverable. Existing platform-only plan editor made directly visible instead of collapsed. No plans/prices invented. User additionally requests report-card text/email/both before, at and after closing. Manual saved-card links now support both channels with independently protected retry identifiers; existing SMS text report-card action remains. Closing-send behavior clarification pending.

- Report-card closing decision resolved: factory AUTO, tenant may choose ASK. Added editable closing-mode and message wording in Communications; native lifecycle checks send a saved report-card link once per selected channel after new ticket closure. A separate activation boundary prevents backfilling old closed tickets. Ask mode presents a review/send choice after checkout; manual text/email/both remain available before and after closure. No unsaved notes/photos are sent. Policy activation regression caught and fixed to preserve disabled tenants and existing confirmation dates. Planner, dispatcher, store and both-channel route tests passed; closing UI and hosted delivery remain unverified.
- Seven-stage UI start/completion verified with fictional records. Care progress moved below existing notes to preserve their order and access. Stage action names include dog/stage for accessibility. Closed history remains readable; no edit to Whiteboard layout. Feature route checks staff, plan and shop scope; Platform Owner access retained. Developer plan editor is directly visible; no subscription packages or prices have been invented. Highest-tier assignment awaits actual plan creation.

### November 19 continuation — report closing, tenant care instructions and staff reports
- Report cards default to automatic sending after closing; tenant may choose Ask staff. Local delivery tests cover both channels, reviewed recipients and stable retry IDs. The saved-card explanation now distinguishes open tickets, closed automatic delivery and manual sending. No live messages or hosted delivery verified.
- Seven-stage instruction editing approved and implemented under Settings → Calendar & Workflow → Seven-stage care. Stage names/order remain fixed, both comfort breaks retained. Staff instructions/customer explanations are tenant-scoped, revision-protected and audited; shared POS stage hints read the same setting. Rubber Doggies-specific standards are not silently applied to other businesses. Three validation/store tests passed; settings screen reviewed, save-bar refinement followed review. Subscription tier assignment remains unfinished until plans are established.
- Return-visit report added by first recorded grooming month, using current tenant retention interval, local calendar days and completed observation windows. Same-day split tickets do not count as a return. Active/inactive customers included for historical cohorts; existing active-customer overdue report preserved. Two calculation tests and seven existing customer-outcome checks passed; visual review remains pending.
- Scheduled staff reports approved: off until configured. Added tenant schedules, selected report groups, reviewed recipient emails, daily/weekly/monthly time, current-snapshot labels, separate recipient copies and delivery-attempt history. Native server loop uses private generated runtime authentication, independent pagination, tenant/location sharing scope, current manager access, configured email and recorded-copy protection. Report calculations extracted unchanged into a shared service; five existing report-route tests passed. Six policy/dispatcher checks and native-loop test passed. Actual provider delivery, UI save review, failure/restart verification and final production build remain unfinished.
- Scheduled reports use prior day, prior seven days or prior calendar month. These ranges are explicit on the form. Monthly choices currently use days 1–28. No reports are sent while the development server runs; all automated checks use fictional recipients/providers. The complete audit remains unfinished. No publication.

- Scheduled-report form visually checked with a fictional weekly schedule: save confirmed sending OFF, and the sole shop was selected without showing a location selector. Screenshot retained outside the repository. Added useful field hints after review. No email was sent.
- Production build passed for care-instruction/report scheduling changes. Subsequent highest-subscription-plan controls require final build/type verification. Developer plan editor now explicitly marks the highest level and includes the seven-stage workflow there; developers may include it in other plans. Three plan-access/default/preservation tests passed. Existing plan features are not removed when the top designation moves. No actual plans or prices created. Paid-plan activation stays blocked pending the deferred billing integration.
- Awaiting tax-report decision: proportionally allocate a partial payment to saved tax, or count tax only on fully paid closed tickets. No tax calculation has been changed while this question is pending.

### Customer tags and recorded stage-time reporting — local continuation
- Added reusable tenant tags, manager-owned tag lists/saved filters, shared profile selection and filtering before the customer-result limit. Retired tags retain existing assignments; omitted tag edits preserve saved choices. Existing phone identity and customer-sharing query enforcement retained. Four focused validation/store/filter/access tests passed. Customer profile/search/phone checks passed after updating outdated test helper dependencies.
- Local fictional browser review saved a customer filter successfully. Added field hints and form padding after review. Offline snapshots now include tag assignments and tag choices; offline search applies tag filters before limits and asks for a refresh when older snapshots lack assignments. Its focused test passed. No customer data or live database changed.
- Added recorded grooming-stage elapsed-time report using closed-ticket dates and saved per-dog Start/Complete records. Comfort stages remain separate. No payroll, scheduled-minute or commission changes; incomplete/invalid records do not affect averages. Focused verification underway.
- Scheduled-report downtime recovery choice and partial-payment tax basis remain pending. All changes remain local; overall audit unfinished and no publication.

- Stage-time report: seven-stage totals/averages, unfinished/invalid counts and shared CSV/print/scheduled-report rows added. Two focused calculations/scope tests plus five existing report-route checks passed. Fictional UI displayed completed versus unfinished stages correctly.
- Added recorded VIP membership payment details from existing PAID/SUCCEEDED rows by processing date, with tax separate and accessible-customer scope across shared shops. No future income, scheduled payments, provider charges or POS reconciliation inferred. Two focused tests and existing report-route checks passed; display verification pending.
- Corrected prepaid report customer-sharing enforcement and its scope wording; three focused tests passed. Retention hint now accurately explains its approved connection to rebooking invitations.
- Production build passed after customer tags/stage-time work. Later VIP reporting, input-preservation refinements and portal appearance additions still need final verification.
- Portal appearance local implementation adds tenant logo, button color/contrast and welcome text to the existing portal. Only public branding is available before phone verification; profile/appointment authorization unchanged. Fifteen focused branding/portal tests passed with initial file mock; real file-validator coverage, visual review and final build remain pending. Custom domain hosting is not configured or claimed complete.
- Additional clarification pending: which customer/ticket changes tenants may automate, and whether tenant-configurable online service eligibility is desired. Existing automation and availability rules preserved until answered.
- Portal branding: five focused tests now include real PNG validation, oversized/non-image rejection, manager-only writes, tenant isolation and stale revisions. Public sign-in appearance was reviewed with fictional branding; no customer details exposed before verification.
- Shop comparison added for owners/managers with each shop's local dates and sharing group, separate payment/sales totals, CSV and print. Calculation/export/access tests passed; fictional two-shop browser totals verified. No processor/bank reconciliation implied.
- Recorded VIP payment display verified using fictional payments. Report-row typing corrected; type checking passed before the subsequent POS-payment report addition.
- Scheduled-report recovery now clears only the successful schedule's previous preparation warning and retains delivery history; six focused runner tests passed. Downtime catch-up policy remains pending.
- Added recorded POS payment details using existing scoped payment records, including ticket, shop-local payment date, method and amount. No provider identifiers, inferred refunds, fees or settlement. CSV/print and scheduled sales report use the same rows. Eleven focused report/access/schedule checks passed; current build and visual review remain underway.
- Latest production build passed, including payment records, portal branding and shop comparisons. Subsequent Settings-search registration and portal form-layout refinements passed type checking.
- Browser review found and fixed missing Seven-stage care breadcrumb registration, which crashed all Settings searches. Destination coverage now passes after including existing Device access and portal anchor components in the older test harness. Portal search/navigation and a fictional appearance save were verified.
- Recorded POS payment rows and return-visit cohorts were verified in the browser with fictional data. Portal welcome was confirmed on the public sign-in screen after saving, with a screenshot retained outside the repository.
- Seven-stage instruction API coverage verifies manager/entitlement restrictions, tenant identity and continued Platform Owner/Developer access. No live database or messages were used.
- Additional business decisions requested: discount-code controls, and monthly-report dates missing from shorter months. No discount-code behavior or monthly-date extension has been assumed.
- Final local appearance review verified the full-width welcome field and Save action; screenshot stored outside the repository. No publish or GoDaddy sync performed. Remaining business-rule questions are still open (tax basis, scheduled-report catch-up, automation account/status actions, online resource/service eligibility, discount codes, monthly dates).
### November 19 tax, booking classes and promotion decisions
- User approved tax reporting only for closed tickets; deposits and cancellation fees are tax-free. Existing checkout already refuses a balance at closure, including its locked transaction recheck. Added saved-tax report/export/scheduled-sales rows by original closing date; open-ticket deposits are excluded. Automatic tax excludes the existing No-Show Fee line. Historical manual tax remains unchanged. Focused tax, report-route and month-end tests passed; type checking passed.
- Monthly staff reports now allow days 1–31 and use the final calendar day in shorter months. Coverage includes leap/non-leap February, April and May; no earlier-day send. Missed-report catch-up remains unanswered; supplied a concrete Monday–Wednesday outage example.
- New requested booking defaults: service Available online OFF, bulk enable by class; employees/assets accept multiple classes. Initial classes Self-Service, Full-Wash, Bath Only, Grooming, Brush Out and each VIP counterpart. Asked whether these are separate booking classes or existing categories, and how to preserve already-online service selections. No existing availability or categories changed pending those decisions.
- Discounts/promotions support requested percent or fixed amounts, including military, referral and VIP examples. Clarification pending for combined eligible discounts; existing referral/VIP benefits remain intact. Offered concrete automatic record-action choices (staff task, customer tag, appointment status) instead of inventing actions.


### November 19 resolved decisions and current verification
- Publication instruction: publish the complete agreed batch when finished and checked; no intermediate uploads. Latest local production build passed for tax reporting, missed-report catch-up, online-booking classes and promotions. Subsequent UI refinements passed type checking; final release checks still remain.
- Scheduled reports now replay every missed scheduled date after their activation, with persisted progress and per-recipient recorded-attempt protection. Restart and three-day downtime tests passed. Monthly days 29–31 use the last available calendar day. Changing a schedule currently evaluates unsent periods from its activation using its latest choices; historical recipient/selection behavior on edits needs a deliberate decision before release.
- Separate online-booking classes added: Self-Service, Full-Wash, Bath Only, Grooming, Brush Out and VIP counterparts; custom class creation, service checkbox and active-service bulk enable. Existing online selections remain; new services start OFF. Employees/assets accept multiple classes; untouched resource assignments preserve legacy availability. Slot lookup, locked booking submission and waitlist use the same class matching. Focused class/availability/household/access tests passed. Fictional service class/Available online save was verified in the browser; employee/asset save flows remain covered by the shared component and store tests, not separately browser-verified.
- Promotions support percent or fixed-dollar offers, dates, optional code, customer tag and VIP eligibility, and selected catalog items. Staff apply the best offer in POS → Account & Rewards; existing larger discounts remain. Fixed-dollar offers require an explicit ticket-versus-line choice, pending the requested factory-default clarification. Existing referral credits, VIP benefits and historical taxes are unchanged. Seven calculation/store tests and two new route-access tests passed. Fictional promotion save and refined layout were reviewed.
- Custom automatic record changes are explicitly tabled by the user. Existing approved automatic messages and staff tasks remain.
- No live customer messages, payments or production data were used. Hosted provider delivery, real database concurrency, external website embedding and GoDaddy operation remain unverified. Original 42/124 counts are not completion counts.

- Updated production build passed after promotion/class UI refinements. Added an imported-price consistency safeguard so applying a promotion cannot make saved ticket totals disagree with their lines; its focused test passed. Promotion store now has four passing checks. Recipient handling after a report-schedule edit is awaiting the user’s decision; publication remains on hold until that and remaining work are resolved.

### November 19 — report history decision implemented
- User selected settings in effect when each missed report was due. Schedule saves now preserve each prior policy, actor and effective interval without nested history. The runner evaluates each interval separately, records its revision with delivery attempts, and checkpoints progress per version. Current disabled schedules, revoked manager access, tenant restrictions and existing duplicate/uncertain-send safeguards still apply. Eleven focused store/runner checks passed, including old-recipient/new-recipient and report-choice preservation after downtime. Live email remains untested.
- Fixed-dollar offers now default to one amount spread across eligible items. Both existing scopes remain tenant selectable. Clarification pending only for the requested additional single-discount option: one staff-selected item versus the entire ticket. No interpretation of that third option has been implemented yet.

### November 19 — discount clarification and implementation
- User explicitly rejected multiplying a fixed discount by item count. Only TICKET (spread one total across eligible items; factory default) and TICKET_LINE (one visible discount row) remain. The store validates both scopes.
- Single-line display preserves normal saved line allocations for commissions/reporting, adds allocated amounts back only for item display, and subtracts the visible discount row once. POS and invoice/receipt use the same validated display helper. Changed or deleted lines cannot retain stale display allocations. Its metadata is included in tenant export. Browser review verified $20 + $30 − $10 = $40.
- Added staff-entered percentage discounts on selected POS items under Account & Rewards, with range/item validation, existing larger-discount protection, closed-ticket/payment safeguards and employee audit details. Focused promotion/store/access tests passed; controls verified in the local fictional UI. The 34-test focused POS/receipt/display batch passed before the final removal of per-item scope and addition of staff percentage; those latter rules passed 12 focused tests.
- User requests a 20% return-visit offer for GR/FFT/FW only, excluding add-ons and Offer Today. Existing rebook implementation already has a 20% two-week/10% four-week/5% six-week scheme with manager overrides, but only tests GROOM/BATH roles and lacks explicit Offer Today exclusion. Asked whether the 14 days constrain the next visit date or the date it is booked. Preserve other approved discount tiers and manager overrides while resolving this.


### November 19 - latest rebooking and referral decisions
- Resolved: 20% is automatic for the same dog returning within 14 days regardless of when booked; 10% within four weeks and 5% within six weeks require booking on the prior appointment day. Same-date time changes preserve eligibility. Moving the date removes the advance tiers; the automatic 20% is reevaluated against the return date. Tenants may extend each deadline through a chosen weekday of its Monday-Sunday week.
- Added shared rebooking eligibility/store, creation, move, line-timing and pre-payment hooks, whole main-package coverage, Offer Today/extra exclusions, existing larger discounts and explicit manager override protection. Focused calendar-day, eligibility, repeat application, date/time move, paid-total and stock-close tests passed. Legacy editor test fixture updated for the existing ticket-readiness guard. Final integration checks remain in progress.
- New requested Refer-A-Friend feature: factory $10 for each person; separate tenant choices for each person's credit or free product/service/add-on. Existing first-paid-groom award timing retained. Existing tenant amount and previously earned credits remain unchanged.
- Implemented referral policy revisions and catalog validation, per-customer share links scoped to business/shop, portal booking referral attribution, automatic once-only reward issuance, POS free-item application/removal and locked consumption at closing. Portal invitation wording is tenant-editable and asks customers for help; no messages to friends are sent automatically.
- Seven focused referral checks passed: legacy/default amount, one-time issuance, different rewards, self/invalid/replacement referral rejection, redemption, restoring a reward line after another ticket redeemed it, wrong item/customer/quantity and payment protection. Two checkout stock checks passed after adding mocked new dependencies. Type checking passed before final spacing/validation changes.
- Fictional browser review verified separate reward choices/save and portal share-link rendering. New form spacing refined and verified. No real referral records, customer messages, payments or database writes used. No GitHub publication; overall audit reconciliation/final verification still unfinished.

### November 19 - incoming email replies and referral safeguards
- Added optional provider receiving-domain configuration and signed incoming-email handling. Reply addresses are unique to outbound customer communications; stored tenant/customer/ticket and sender checks prevent attaching replies to an unrelated profile. Replayed events are idempotent. Retrieved HTML is converted to plain text; attachments are identified, not downloaded. Existing sending works unchanged without receiving configuration. Live provider receiving remains unverified and requires the documented host/provider setup.
- Four focused reply-store checks passed, plus the existing email sending/delivery suite. Added a configured reply-to sending check, which passed. Type checking passed after adding the incoming-reply service. No real email sent or received.
- Portal now allows a customer to clear an invalid/unwanted referral link and continue booking. This does not erase an existing shop-recorded referral or bypass referral award checks.
- Whole-audit reconciliation remains in progress. No publication or assertion that all baseline Missing/Partial items are finished.

### November 19 - current VIP enrollment groups
- Added current status grouped by the membership start month and saved membership name for the selected reporting dates. Active, cancellation requested, pause requested, paused, ended and other statuses remain separate; no historical status is invented. Uses existing accessible membership records, the shop time zone and the report snapshot time. CSV, print and configured summary emails use the same rows.
- Two focused date/grouping/export tests and six existing report-route access/calculation checks passed. The report route fixture now includes the new pure calculation dependency. Fictional browser review verified the six-membership example and separate pending/ended counts. Earlier production build passed before this report addition; updated type checking/release verification follows.
- Asked whether manual vehicle/maintenance/cost records should be included now or stay with deferred mobile routing. No vehicle behavior assumed while this decision is pending.

- Latest production build passed after the VIP enrollment report and referral-link continuation additions. Type checking passed; signed incoming-email callback coverage also passed (five reply tests total). Generated Next/TypeScript configuration files restored to the committed versions. No GitHub upload.
- Additional decision requested: cross-shop online availability for shared employees, including shops in different customer-sharing groups. Existing filtering remains unchanged pending the answer.

### November 19 - refund and shift-location decisions
- Vehicle maintenance, mileage and operating costs stay with Maps/routing; user wants that group after the other audit work.
- User approved native cash refunds and customer-account credits now, with staff choosing whether returned merchandise goes back to sellable stock. Original closed tickets must remain in history. Commission-reversal behavior and tax-default choice are awaiting clarification; no refund posting route has been enabled yet.
- Added pure refund-request validation and remaining-paid/item/tax/tip/stock bounds. Four focused tests passed. Ordinary item refunds exclude stored-value purchases and prior-balance collection lines, whose associated balances require their own reversal handling. This is groundwork, not a completed refund workflow.
- User clarified shop availability follows scheduled work hours: an employee scheduled at Shop A is off at Shop B. Inspection found EmployeeSchedule currently stores user/weekday/hours without a shift shop, and online availability falls back to the employee-level location. Asked how to handle existing unassigned shifts before changing availability; no scheduling behavior changed yet.

### November 19 - proportional refunds and shift shops, local continuation
- User approved automatic proportional commission and tip reversals, tax included by default, and existing shift resolution from assigned shop (sole shop automatically; otherwise require a shop choice before online availability).
- Added manager-authorized closed-ticket cash/account-credit refunds with exact retry protection, remaining-paid/item/tax/tip limits, optional stock returns and a separate ledger. Original tickets/payments remain unchanged. Split tips reverse proportionally, including cent rounding and any unallocated tip; later allocation cannot reuse refunded tips. Employee earnings use the original closing period. Refund reporting uses refund recording date and accessible tickets only; CSV/print/scheduled sales exports include it.
- Eight refund calculation/store tests and nine refund-access/report/tip/employee-report tests passed. Sixteen profile/schedule route tests passed after updating their older dependency fixtures. Offline schedule editing checks passed. Nine portal availability checks now cover unresolved shops, assigned-shop fallback, explicit shift/date shop overrides and cross-shop occupied employees without exposing customer details.
- Shift metadata is shared by Schedule, Calendar, assignment availability, offline schedule snapshots/replay and tenant export. A multi-shop selector stays hidden for a sole-shop tenant. A booked employee cannot be offered online simultaneously at another shop; tenant-wide booking transaction locking already exists.
- Fictional refund form review confirmed item selection, $100 plus $8 suggested tax, cash/account-credit choices and expandable window. Fixed narrow-form field spacing; no real refund or database mutation occurred. Production build passed before the final cross-shop busy-query refinement; final verification follows.
- Asked whether gift-card/prepaid purchase refunds should be limited to unused value and remove that value, or remain deferred. These balance-bearing purchases are deliberately not ordinary item refunds while that decision is pending.
- Overall audit reconciliation remains unfinished; no GitHub upload or live GoDaddy verification.

### November 19 - gift/prepaid refund and gifting decisions
- User set gift cards and prepaid packages nonrefundable by default, independently tenant-editable. When enabled, refunds remove unused card value or whole unused prepaid visits at their saved purchase value.
- User approved gifting some or all unused visits; a one-dog package retains that restriction and waits for the recipient's dog assignment. Original purchase/visit history and expiration remain intact; transferred visits do not become another sale.
- For gifted prepaid visits, staff choose refunding the recipient or original purchaser. Credit is posted to that selected customer's account; cash refunds record the selected recipient. Other items/tips cannot be routed to a gift recipient.
- Local implementation includes tenant policy, stored-value reduction in the refund transaction, exact remaining-visit value allocation, separate gift/refund history, recipient choice, and report balance reductions. Thirty relevant refund/prepaid/gift checks plus two policy/report checks passed. UI/route integration review and final release checks remain underway; no publication.

### November 19 - gifted-visit refund recipient verification
- Gifted prepaid refunds offer the original purchaser or the current recipient. Fictional browser review selected two unused visits and the receiving family; no refund was submitted. The original purchase stays in history.
- Twenty focused refund, gifting and employee-report checks passed. Type checking passed after adding assigned closed-line sales to the employee time-and-earnings report. Utilization calculation awaits the requested business definition; no calculation has been guessed.
- Older saved gift-card/prepaid reports now identify unavailable measures instead of displaying an invalid currency amount. Existing daily sales bars were confirmed in the report; no duplicate chart was added.
- The full audit remains unfinished and unpublished. General custom-rule scope and employee utilization are awaiting clarification; production/provider verification is not claimed.

- Production build passed for the refund-recipient and employee-sales changes. Six export/print checks passed after the saved-report wording correction. Generated Next/TypeScript files restored to their committed versions. No GitHub publication.

### November 19 - requested completed-batch publication
- User explicitly requested publishing completed changes now. This overrides the earlier hold for whole-audit completion for this release. All completed local application, test and supporting documentation changes are included together.
- Custom-rule options and the utilization break treatment remain pending; no unapproved rule builder or utilization ratio is included. Overall audit completion and live GoDaddy/provider verification are not claimed.

### November 19 - customer account change reporting
- Added a separate report of existing Balance Owed and Customer Credit ledger entries, preserving signed amounts, recorded dates and reasons. Access is restricted to tenant customers available to the current shop; shared-customer scope is explicit. No account balance, payment, sales calculation or business rule changes. CSV/print use the same snapshot.
- Fifteen focused report/access/export/print checks and type checking passed. Fictional narrow/desktop review verified amounts and the shared help popup; no production records were accessed or changed. This follow-up remains local after published b13a17b.
- Employee utilization denominator clarified: subtract recorded breaks. User requested an explanation before approving employee Start/Pause/Resume/Finish work timers; those controls are not implemented pending their answer. Dog-stage elapsed time is not substituted for employee working time.
- Production build passed for account-change reporting; generated build configuration restored. Local follow-up remains unpublished.

### November 20 - continuing without publication
- User directs continuation of remaining approved work, no publication. Explicitly deferred/provider-dependent and unauthorized scope remains protected.
- Productivity Report now uses assigned service duration × quantity. Past appointment dates use closed tickets divided by clocked hours minus breaks; today/future use booked items divided by scheduled hours. Mixed ranges show both separately. Cancelled, voided, no-show, draft and unaccepted requests are excluded. User clarified refunds do not penalize productivity, so refunded work stays included. No employee stopwatch controls were added. Unknown hours remain unavailable, not zero productivity.
- Scheduled-hour helpers resolve shop-specific shifts and date overrides, merge overlaps and respect local dates/DST. Three focused period/schedule checks and 16 productivity/report/access/export/print checks passed; type checking passed. Fictional desktop review verified 6 / 7.5 = 80% and 6 / 8 = 75%. Production build is underway.
- VIP activity now shows recorded starts, cancellation/pause requests, resumes and ends using their actual saved event dates; no current-state reconstruction or assumed completed cancellation. Accessible-customer scope, duplicate protection and invalid-date handling tested. Sixteen focused report checks and fictional desktop review passed. Historical cohort retention remains incomplete.
- User approved custom rules creating staff tasks, internal notifications and customer messages. Automatic account/status mutation remains excluded. Activation/backfill and overlapping-message behavior await user decisions.
- Production build passed for Productivity Report and VIP activity. No publication. Custom-rule validation groundwork passes three focused checks but is not yet an executable rule builder.

### November 20 — local refund, deposit, void and message-limit work
- Latest user decision: every purchase defaults to Customer Credit refunds; tenants may enable cash refunds. Gift cards and prepaid packages remain independently nonrefundable by default. Server checks and the shared refund form enforce the method choice, including credit-funded purchases. No provider refund was added.
- Deposits record funds already received as Customer Credit, without tax or a second ticket payment. Ticket checkout, receipts, prepaid/gift activation and receivables now count applied credit toward settlement without treating it as new collected money. Credit and deposit retries use operation identifiers; changed retry details are rejected. Separate deposit reporting preserves existing sales calculations.
- Unpaid-ticket voiding retains all history, requires a reason and tenant-selected permitted roles, and blocks payments, used credit, closed tickets and in-flight no-show charges. Voided records are separated from cancellations in reporting and print as nonpayable history. The default grants no tenant roles until selected; platform authority remains intact.
- Account-funded no-show fees now use credit and complete the fee/account/history changes together. Sufficient credit covers the fee even when a card is saved. With no card, partial credit reduces the remainder owed. Partial credit with a saved card still awaits the user's charge-versus-carry decision; existing card behavior is not changed for that case.
- Latest marketing default: one marketing event per customer per week, tenant editable by day/week and amount. Shared reservations coordinate simultaneous rules and channels; a week is a rolling seven days. Rebooking invitations now use the limit. Classification of birthday/review messages remains pending, and custom-rule activation/execution is not yet complete.
- Marketing settings were reviewed and saved with a fictional API fixture. Eighteen focused marketing/dispatcher/refund checks, seven no-show/deposit checks, four credit retry/debt checks, four receipt checks, two report access checks and two marketing settings permission/revision checks passed. No external messages, real payments or production records were involved.
- Production build passed through the initial void/deposit/refund batch. Later marketing/no-show additions have focused checks; final compilation verification remains required. Nothing after b13a17b has been published.

- Final production build passed for the current marketing/deposit/void/refund additions. The void access window was reviewed with fictional records; its close control worked and no real role permissions were changed. Additional fee-race check passed. Build-generated configuration was restored; no publication.

- User clarified marketing cap covers rebooking invitations/promotional offers only, not birthdays or review requests. Paused VIP memberships must be excluded from retention. With partial credit, a saved card pays only the remainder; without a card, the remainder is carried in Balance Owed.
- Local card-fee path now reserves Customer Credit before charging only the remainder, restores it once after a definite decline, and retains the reservation if the provider result is uncertain. No provider was called during tests. Twelve focused reservation/rule-plan checks and type checking passed. This extends the existing Clover path only; no new processor integration or live readiness claim.
- Custom-rule planning now chooses the first matching priority/name, honors new-only versus included existing events, ignores obsolete events and preserves standard-message replacement while a selected rule is delayed. The editor still saves drafts only; execution/activation remain unfinished.

- Mocked provider outcome check passed: the reserved operation identifier and $25 remainder are sent for a $45 fee/$20 credit example; server errors, timeouts and missing acceptance identifiers remain uncertain instead of releasing credit for an unsafe retry. No real card was charged. Later card and planner additions are type-checked; the preceding full build does not constitute verification of live payment delivery.

### November 20 — local custom staff execution and VIP retention
- VIP retention now measures initially active memberships, excluding actual pauses and ends. Unknown earlier pause history suppresses a misleading percentage. Multiple resumes do not imply uninterrupted activity. CSV and shared report UI include the measure. Focused retention/activity/export checks passed; fictional report review showed 100 initial, 85 retained, 5 paused, 10 ended = 85%.
- Appointment and recorded VIP membership events can now activate task/internal-notice rules. Turning on requires choosing new-only versus existing matching records; pausing permits draft editing and preserves prior tasks/notices. Tenant locks, revision checks and event claims prevent stale or competing rules from duplicating staff actions. Customer-message rules and remaining events still cannot activate until their runtime is complete.
- Native server scheduler pages custom staff execution independently; no browser or external scheduler is required. No scheduler was started against production. Tests cover authentication, activation permissions, current-event checks, tenant/recipient scope, repeat processing, priorities and delays. Customer-linked tasks/notices preserve accessible-customer restrictions; Whiteboard layout is unchanged.
- Fictional UI review verified draft save, activation, pause, staff-notice display/read completion and retention. No customer messages or real database changes were made. Latest membership-event/type checks passed; full production build follows. No publication.


### November 20 continuation — custom customer messages and current-event safeguards
- Added tenant-selected closing-message replacement (review request or report-card notice), separate booking notices, membership messages, and overdue-task staff actions. Existing confirmation timing remains 7/5/3/2 days plus appointment morning; the user's five-day example does not change it.
- Booking notices now cover rebooking and accepted online requests, exclude pending/rejected requests, and preserve separate attendance confirmation. Online review audit records the decision and scheduled time without changing approval behavior.
- Custom delivery retains current-record checks, consent, tenant access, recorded outcome uncertainty, deduplication, and shared promotional limits. Cancelled tickets with a fee are not inferred to be no-shows.
- Recent rule activity shows recorded staff actions, delivery results, and the last failed attempt with customer-sharing filtering. A last failure is explicitly historical, not a claim that a later retry failed.
- Focused tests: ticket events/runner/replacement 13 passed; history/route/runner/overdue tasks 12 passed. Typecheck passed. Local fictional preview verified closing replacement choice, help, and resizable editor; no real messages sent.
- Still incomplete: remaining custom event/condition coverage, full effectiveness reporting/retry workflow, fresh offline report calculation, audit reconciliation and external-host verification. Questions pending for any-response semantics and employee stopping a specific follow-up. No publication.

- Added Reports → Custom rule results, with shared CSV/print/scheduled-report output: recorded task creation/current completion, staff notices, delivery attempts and distinct delivered/failed/unconfirmed/not-submitted counts. Customer sharing and employee staff-action scope remain enforced. Three focused tests passed; desktop/phone fictional preview reviewed. Booking attribution remains pending an explicit definition.
- No-show rule recognition accepts the explicit noShowStatus audit marker for the existing CANCELLED storage convention; a fee alone never proves no-show. Six event tests passed.
- Additional questions pending: whether any incoming customer reply counts; stopping a pending follow-up after staff intervention; message-linked booking attribution; balance reminders per increase versus per outstanding-balance episode.

- Production build after custom delivery/history/results completed successfully (audit-custom-delivery-build.log); only existing CSS alignment compatibility warnings. Build-generated TypeScript config changes restored. No GitHub upload.


### Latest user clarifications and implementation
- Booking after a message must count through any medium, including a call entered by staff. Implemented customer-level “Customers booked afterward” in custom rule results/CSV/print, deduplicated per rule across text/email. Excludes earlier bookings, pending/rejected requests, cancelled/no-show tickets. Rules can overlap; no causal attribution claim. Four focused report tests passed.
- Staff recording confirmation should automatically stop requests, without a second stop action. Added atomic attendance recording to explicit manual POS Confirmed status; online shop acceptance, custom stage aliases and undo-check-in remain separate. Existing reminder selections preserved; repeated confirmation is idempotent. Six attendance tests and ten message-runner tests passed.
- An explicit per-follow-up Stop action with reason is approved only as an override; automatic conditions must still stop obsolete work. Implementation still pending. User was asked whether to add Customer confirmed beside Status for online bookings already marked Confirmed by shop acceptance.
- “Customer responded” still needs its use explained; do not equate arbitrary replies with confirmation. User requires an automated answer giving dog/date/time when a customer asks that question. This reply behavior remains to implement after inspecting inbound messaging.
- Balance reminder approved once per increase; stop when paid before sending. User clarified Balance Owed represents unpaid fees, not layaway or permission to close unpaid grooming sales. Preserve existing manager account corrections. Balance rule implementation pending.
- Unfinished-booking custom rules now use the existing tenant inactivity setting (30-minute factory), current customer/pet/location records, and stop for resumed/reviewed/completed attempts. Ten focused runner/endpoint tests passed; typecheck pending/completing. This addition follows the successful production build and is not covered by that prior build.

- User explicitly corrected status meaning: shop acceptance = Accepted; customer confirmation via any medium = Confirmed. New online acceptance/automatic approval now uses existing OPEN storage with Accepted POS/portal wording, leaving bookingDecision ACCEPTED. Portal attendance confirmation advances POS status to CONFIRMED atomically. Accepted bookings retain Add to calendar. No new separate confirmation checkbox. Eight attendance tests passed. Existing historical automatically-confirmed records have not been rewritten; cross-channel reply handling and full status display consistency are still being completed.
- Balance rules now scan positive OWED ledger entries, use one stable event per increase, recheck current balance, and avoid reviving an earlier paid-off balance when a new fee appears. Three focused tests passed. No charges or financial account changes are made by this rule.

- User approved correction of existing upcoming online bookings incorrectly marked Confirmed by shop acceptance. Added deployment-only, repeat-safe correction with per-ticket history: only ONLINE/ACCEPTED/CONFIRMED future bookings, no custom status or closing date; preserves current-time attendance confirmation, confirmation audit, and recorded manual confirmation. Runs before server startup, not during build or verify-only. Focused mock tests passed; no live database run or publication. Rescheduling confirmation behavior is awaiting the user’s example-based decision.

- User approved retaining Confirmed when staff explicitly decline a new confirmation request after moving an appointment. Current-time attendance is retained for that choice; choosing a new request returns builtin Confirmed to Accepted. Nine focused reschedule/label/hover tests passed. Calendar popup uses the shared status label without changing custom labels. Removed immediate confirmation on booking acceptance so booking notices remain separate from the tenant confirmation schedule.

- Combined production build passed after the acceptance/rescheduling fixes (audit-acceptance-build.log); only existing CSS alignment compatibility warnings. Restored build-generated config changes. Scheduler tests passed with no real delivery. No publication or live correction run.

- Added verified text/email reply confirmation for clear standalone answers (Yes, Confirmed, We will be there). Each new outbound confirmation request records its exact customer/ticket/time context before delivery. Replies require that context and a nonfailed outbound message, reject old times/pending cancellations/questions/qualified or quoted text, retain reminder choices, and audit the confirmation. Text/email webhook signatures and sender checks remain in place. Eighteen focused tests passed; no real messages sent. Full AI/voicemail interpretation and automatic appointment-detail answers are still unfinished; this bounded reply recognition must not be described as complete AI handling.

- Added Sales breakdowns → Sales and refunds reconciliation, preserving original sales calculations. Closing-date net line sales minus recorded-period eligible item refunds; excludes refunded tax/tips, gift-card purchase refunds and prior-balance refunds. Voided unpaid totals are shown separately, not deducted twice. Unmatched original refund lines suppress the net total as Needs review. Uses tenant/location/customer-access scoped original lines. Existing Account Changes remains separate. Seven calculation tests and seven export/print tests passed; TypeScript passed before the equivalent typed-object cleanup. Desktop and phone fictional UI reviewed (sales-refund-reconciliation-review.jpg). This and inbound reply handling follow the previous successful production build; no publication.

- Ticket custom staff actions now recheck current appointment state, attendance confirmation, VIP/upcoming/tag conditions and location immediately before creating tasks/notices; nine focused tests passed, including confirmation arriving during processing.
- Added optional POS → Ticket actions → Pending follow-ups for ticket-linked custom rules. Fresh matching events only; existing event claims hide already-started work. Stop requires a recorded reason, runs under the same tenant lock as execution, and suppresses only that event while preserving future events/rule activation. History includes the reason. Three stop/list tests and seven action/history tests passed; UI verification in progress. This does not add an extra step to normal confirmation, and does not yet provide manual stops for non-ticket membership/balance/task follow-ups.

- Pending follow-ups UI was verified with isolated fictional records: select, enter reason, stop, success and empty list. Three route checks passed for authentication, tenant/actor scope and invalid identifiers. Combined production build passed (audit-continuation-final-build.log), including replies, sales reconciliation and the initial stop control. No live correction or delivery occurred.
- VIP staff tasks/notices now recheck membership/customer eligibility immediately before creating the action. Seven focused runner tests and type checking passed after that additional safeguard.
- Customer-due custom rules now reuse the six-week/tenant retention interval, local due date and latest completed grooming. Phone/staff/online future bookings (including pending requests), inactive customers/pets, transferred pets and newer completed visits suppress obsolete follow-ups. Custom invitation replaces only the standard rebooking message, uses its stable message identity and remains subject to marketing limits. Staff tasks/notices recheck eligibility under the execution lock. Stop is available from the last ticket for this synthetic follow-up event too. Six retention tests, twenty dispatcher/endpoint/store checks and four stop checks passed; initial type check passed. This addition follows the last full build.
- Offline report scope question is pending: tenant-chosen history versus downloading all reporting history. Existing limited offline records and saved report snapshots remain unchanged until that conflict is resolved. Pet/program eligibility meaning remains pending; no eligibility rules invented.

- The overdue-customer rule production build passed (audit-retention-final-build.log). Afterwards, its final check was strengthened to reload active customer/pet ownership, including one transferred dog among several; twelve retention/stop checks and type checking passed. Duplicate generic hints are now suppressed when the same label already has its own question-mark explanation. Fictional narrow-screen review confirmed no duplicate tooltip and one-click stop completion (follow-up-hint-review.jpg). No live messages, payments, database correction, or GitHub publication occurred.
- Retry decision now pending: automatically retry a definitively failed message after its contact details are corrected, versus staff-triggered Retry. Uncertain provider outcomes remain protected from automatic resending. General AI/voicemail handling has no connected implementation in this checkout and is not represented as complete.

- November 20 continuation: Reorder Menu now reloads business preference context after employee sign-in, avoids incomplete identity keys, and reports failed browser storage instead of silently presenting an unsaved order. Two focused persistence/isolation/error tests passed; isolated browser review moved Day before Map and confirmed the same order after refresh (menu-order-refresh-review.png). Preferences remain employee/business/location scoped. No publication.
- Bounced-email correction and manual confirmation request are implemented locally: current-address bounce alert, shared customer editor, email-only corrected-address retry, and a staff request outside the regular schedule. Requests preserve reminder choices and refuse confirmed/cancelled/stale/uncertain-delivery cases. Four queue/correction tests and the focused dispatcher/attendance suite passed, plus type checking. POS visual verification and full release build are still pending for this addition; no actual messages sent.
- User resolved offline scope: download full reporting history. Earlier pending question is superseded; full-history reporting implementation remains outstanding. Pet/program custom-rule eligibility remains undefined; explained as marketing/task targeting, with no new criteria invented.


### November 20 — full offline reporting history and confirmation review
- Full reporting history now downloads in scoped pages into a separate device archive. New date ranges calculate locally using the same pure calculations as online reports; incomplete downloads preserve the last complete copy, permission changes invalidate it, and pending customer/POS edits remain separate. Other-shop comparisons still require a connection. Saved-time wording explicitly excludes later and unsynced changes.
- Focused history/source/route tests passed (10 checks). Existing offline device simulation passed with a never-opened 2020 range, storage restart and queued edits. Shared calculation tests passed after updating test-only dependency mocks; production build passed (audit-history-confirmation-build.log).
- Actual isolated browser review calculated January 2020 fictional sales of $50 from the downloaded archive while the report endpoint returned 503. Initial fixture lacked the offline staff lookup; fixing the fixture completed preparation. Screenshot: ../offline-history-review.png. No live database or provider was used.
- Bounced-email POS alert opened the existing shared Customer Profile correctly. Manual/corrected-address request API tests passed; no real message was sent. Production build covers these additions.
- Build-generated config restored after stopping the isolated review servers. All changes remain local and unpublished. Remaining custom-rule targeting decisions, AI/voicemail integration and host/provider verification are not represented as complete.

- Customer Profile → Communication History now opens Pending follow-ups for VIP membership and Balance Owed rules, reusing the ticket stop window. Stops require a reason, recheck current customer access/state/revision/claim under the execution lock, record the employee and leave balances/membership/rule activation unchanged. Four behavior checks, three route checks, and prior balance/membership/ticket checks passed. Fictional UI exercised stop and success.
- User approved dog service/package and VIP targeting. Added optional tenant-scoped selections, same-dog matching, active ownership/membership checks, priority fallback, current-state action guards and matching dog names in custom wording. Service targeting uses services in the dog's explicitly assigned package; no new pet assignment field or breed fallback was invented. Untargeted existing rules require no new pet queries. Four focused eligibility tests and affected policy/store/planner/runner/message checks passed; new route checks passed. Initial test-only dependency mocks were updated for the shared helper.
- Combined production build passed (audit-targeting-followups-build.log). Fictional narrow-screen review verified customer follow-up control and dog-targeting choices/help (../customer-follow-up-review.png, ../dog-targeting-review.png). No actual messages, payments, production records or GitHub publication.
- Remaining any-response semantics question now includes a specific bath-offer example; confirmation remains a separate condition. General AI/voicemail interpretation, non-customer overdue-task override UI, host/provider verification and original deferred work remain unfinished.


### Local continuation — appointment replies, overrides and pending offline appointments
- Clear inbound date/time questions use actual appointment/pet/location details and tenant-editable wording. Ambiguous questions stay in the inbox; no attendance/status change. Five focused tests plus prior inbound/dispatcher coverage and production build passed; Settings → Communications reviewed locally. No live messages sent.
- Staff tasks now reuse Pending follow-ups, preserving task visibility, linked-customer sharing, hidden platform owners and reason/audit requirements. Completing a task remains sufficient to stop overdue follow-ups. Unfinished-booking overrides are included in Customer Profile → Communication History; finishing/resolving a booking remains sufficient. Focused task, route and booking tests passed; task UI reviewed using fictional records.
- User approved pending offline appointment changes in reports. Appointment counts, forecasts and planned productivity overlay queued appointments; financial reporting retains saved payments/closed tickets. Six reporting-history tests and report-export tests passed. Final combined build pending.
- Marketing response semantics remain under clarification: only the relevant customer/offer pauses based on their response; neither inbox handling nor all campaigns stops. No blanket any-response stop implemented.

Combined production build passed (`audit-followups-offline-build.log`). Offline simulated-device integration now also asserts pending appointments appear in forecast without financial changes, survive restart, and sync exactly once. Next-generated config restored to original bytes. No publish or live sending.

### Failed custom-message retries
Owner/manager retry on definitively failed, undelivered or bounced messages from the current rule version. Original communication retained; stable new attempt IDs prevent duplicate submissions. Normal workers revalidate current event/rule/consent/targeting and marketing allowance. Unknown/accepted/sending/complained/suppressed outcomes are excluded. 19 dispatcher/retry tests plus 2 route tests passed; production build and isolated UI feedback reviewed. Older messages without recorded rule revision require review, not automatic replay. No publish/provider sending.

### Offline shop reporting completed locally
Owners/managers prepare each shop’s full reporting archive through existing scoped report access. Comparison manifest is replaced only after every shop prepares; role/access checks remain, incomplete preparation does not expose older comparison manifests. Offline shop switching and comparisons use each shop time zone. Pending appointment changes affect counts/forecasts/planned productivity only. Eight calculation tests, simulated two-shop restart/queue integration and production build passed. Isolated browser with report endpoint503 showed two fictional shops at $50 each, total $100 from January2020 archives (../offline-shop-comparison-review.png). Generated configs restored; nothing published.

### Conversation follow-up continuation — November 20, 2026
- Confirmed factory rule: original offer sent on local day 1–22 resumes on next month’s 1st; day 23 onward resumes on next month’s 15th, 09:00 shop time. Next month is relative to the customer reply; explicit requested dates take priority. Tenant overrides are validated and revision-protected.
- Local implementation: conversation policy, settings API, OpenAI structured-response adapter, customer/offer conversation records, worker with processing leases, stale-reply protection and fresh booking checks. No real provider calls or customer messages were made.
- Focused checks passed: policy 4, settings API 2, API adapter 3, conversation state 3, conversation runner 5; TypeScript check passed. These use isolated mocks and do not prove real database concurrency or live delivery.
- NOT complete/NOT connected to live dispatch: incoming webhook fallback, native scheduler registration, standard rebooking context, existing marketing-send pause guards, staff review visibility, tenant settings UI and its visual verification. Complete these together before enabling live conversation processing. No audit item newly marked resolved; no GitHub publication.
- Production build passed: `../audit-conversation-foundation-build.log`. Build-generated TypeScript configuration changes restored to HEAD.

### Conversation integration completed locally — November 20 continuation
- Connected SMS/email fallback after existing attendance/date-time handling, native scheduler tenant paging, custom marketing and standard rebooking pause guards, staff review/stop visibility, and tenant timing/acknowledgement settings. No general inbox or appointment-message shutdown.
- Standard rebooking retains context and settings revision; new customer replies retain conversation memory. Processing leases, stale incoming-message checks, fresh rule/policy/eligibility/booking checks, marketing limits and uncertain-delivery review remain enforced. Staff stop records a reason; settings retain shop timezone.
- Focused policy/API/adapter/conversation/runner tests, existing affected email and appointment dispatch tests, native scheduler continuation and authentication tests, and customer follow-up checks passed. Initial missing mock dependencies and a final scope error were corrected and the affected checks rerun successfully. TypeScript passed. Final production build passed: `../audit-conversation-final-build.log`.
- Isolated narrow-screen Settings review verified defaults, saved choices and tenant-edited acknowledgement text: `../conversation-settings-review.png`, `../conversation-wording-review.png`. All review servers stopped; generated configs restored. No production data, actual API/provider sending, commits or publication.
- Audit now 108 resolved in approved scope / 58 open. Remaining categories: 19 provider/payment dependencies; 12 live/complete verification items; 2 deferred automatic record changes; 2 deferred shop imports; 2 unauthorized Training items; 21 deferred Maps/mobile items. These are not declared complete. Live OpenAI/SMS/email/host checks need configured services and a suitable authorized test environment; local mocks do not establish those outcomes.

### Focused verification and corrections — November 20
- Corrected the scope misunderstanding: seven user-attention bullets were groups, not seven audit rows; 58 minus seven is not the count of independent implementation items. Deferred feature work remains deferred.
- Booking availability now passes its transaction to locationHours, so regular/special hours and resources use the same connection during final booking verification. Existing business-hours behavior remains unchanged. Two new transaction tests and nine affected availability checks passed.
- Portable records include AI_CONVERSATION_POLICY and CUSTOMER_OFFER_CONVERSATION records. A focused export check confirms history/pause references survive while passwords/connection secrets remain excluded. This is not a disaster-recovery claim.
- HelpPopup Escape dismissal suppresses the restored-focus open event. Reproduced the bug, then verified the corrected fresh browser bundle: zero matching dialogs/tooltips, focus retained on the question-mark control. Early checks hit stale review bundles; the fresh-load check passed. Proof: ../help-escape-review.png.
- Generated portalEmbed rendered branding and sign-in in a distinct-origin fictional website. Embedded button/keyboard interaction failed in the browser tool, not proven to be an app failure; kept the full widget sign-in check unverified. Proof: ../booking-widget-review.png. No real messages were sent.
- Requested the location of an existing isolated test database for simultaneous-booking and restore verification. Do not use working-shop records or treat mock tests as real database concurrency/recovery proof. Review servers stopped. Production build pending in ../audit-verification-corrections-build.log; no publication.
- Final production build passed: `../audit-verification-corrections-build.log`. Generated config restored. Audit totals remain 108 resolved / 58 open because these corrections do not replace the outstanding complete/live verification.

### Continued local verification — hints and Agreement Settings
- Fixed delayed generic hints appearing after Escape or after leaving the browser window. Two focused event/timer tests passed, plus placement checks. Browser confirmed Escape dismisses the hint while retaining Customer Profile.
- Birthday hints now choose the correct customer/pet destination from the editor context. Focused context check passed; desktop and 390px browser checks verified the pet destination and no overlap with the field. No labels or data were renamed.
- Reproduced Agreement Settings close control falling behind the blue menu after resizing: hit testing reached the employee switch button. Rendered the existing settings window in a body portal while retaining React preference/layout context. Verified X closes without opening PIN, Full Size/Restore Size operate, and controls remain on top after phone/desktop resizing. Saved geometry is unchanged.
- Fictional responsive reviews: Agreement Settings at 390px and 768px, service editor and new product/package forms at 390px. Fields fit within each window; initial focus stays outside editable inputs. Error-state agreement structure also remains visible. These focused checks do not establish universal all-module/device completion.
- Proof images in the parent work folder: field-hint-dismissal-review.png, pet-birthday-hint-review.png, agreement-phone-review.png, agreement-layering-review.png, package-phone-review.png. Local fixture now supplies a fictional agreement policy, with no production/database/provider calls.
- User-provided hosted test site opens but remains at Platform Owner/Developer PIN; no records changed. Available browser controls lack tab-scoped network emulation, so true offline/reconnect verification remains outstanding. Isolated test-site access does not itself provide database restore/concurrency access.
- Production build passed: ../audit-hints-layering-build.log. Nothing published.

### Further responsive and wording verification
- Fictional 390px reviews also covered VIP plans, employee editing, staff tasks, Messaging, Inventory stock-history viewing, Tickets and Settings. At 768px the service/product/package/VIP editors and Reports controls remained within their windows. POS showed its complete empty form before customer selection; Owes opened Account & Rewards. Scheduled report controls were readable with neutral initial focus. No customer message, payment, real record update or report schedule was submitted.
- Scoped no-show explanation now says Customer Credit is used first; payment behavior remains unchanged. Known saved-card decline settlement still needs provider-specific resolution and is not claimed complete.
- Added reviewed purposes for existing reminder, portal-rule, deposit, tip, refund, referral, staff-task, compensation and layout controls. Scoped descriptions distinguish customer contact notes, time-block labels, template messages and layout labels. No saved field names, values, permissions or business rules changed. Automatic online booking option now says Accept rather than Confirm, matching the previously approved acceptance/attendance distinction.
- Labels now reuse their control’s more specific reviewed hint when applicable (for example Received by → Deposit payment method), so hovering the label and input gives consistent guidance. Two focused behavior tests passed; the first run exposed an overly broad test double and was corrected. Eight placement/dismissal checks also passed. No generic business rule is invented for an unreviewed field.
- Proof: ../settings-phone-review.png, ../settings-hint-review.png, ../messaging-phone-review.png, ../scheduled-reports-phone-review.png, ../pos-phone-form-review.png; earlier screenshots remain listed above.
- Production build passed before the expanded field-purpose review (../audit-responsive-final-build.log). The build covering expanded guidance is tracked separately in ../audit-field-guidance-build.log. Universal public/employee content and physical-device verification are not declared complete merely from these focused reviews. Audit totals remain 108 resolved in approved scope / 58 open. No publication.

- Expanded field-guidance production build passed: ../audit-field-guidance-build.log. Fictional 390px browser verified contact guidance, no field overlap and no off-screen popup (../contact-guidance-phone-review.png). Review servers stopped and generated configuration restored. No publication.

### Customer-facing hint coverage
- Customer portal and intake/VIP forms previously had no shared field-hint renderer. Added a customer-only renderer using the existing placement/highlight behavior, without staff Find destinations or employee wording. Unknown customer fields do not inherit unrelated staff explanations.
- Public branding and authorized agreement views return only the tenant’s hint enabled/color preferences. No workflow settings, employee identity or credentials are exposed. Intake station caches preserve these presentation preferences for offline use; older cached stations remain without new hints until preferences are available.
- Existing customer authentication, agreement signatures, profile saving, booking and staff navigation remain unchanged. Public hints are hidden until the business preference is known. The standalone intake phone step reads the existing public branding response when it has a shop link.
- Seventeen affected customer-hint/portal-access/offline-agreement/dismissal checks and two agreement-access checks passed. Build and browser review tracked in ../audit-customer-hints-build.log. Nothing published.

- Customer-hint production build passed: ../audit-customer-hints-build.log. Fictional phone browser checked portal sign-in/profile guidance and intake fields, neutral initial focus, tenant color #316ad4, disabled-hint policy and no staff Find paths. No agreement was signed, record saved or real message sent. Proof: ../portal-hint-phone-review.png and ../intake-hint-phone-review.png. Servers stopped; generated configuration restored. No publication.

### Native optional modules verification
- Audit 209 is resolved in approved scope: six focused tests cover plan editing, developer grants, tenant separation and role permissions. Existing customer-contact paid-plan rule preserved. Billing connection remains separately blocked. No publication.

### Native verification without host sign-in — November 20
- Isolated official MariaDB 11.4.5 ZIP (vendor SHA-256 checked), loopback-only on port 33379, fictional databases only. No dependency upgrades or live database reads/writes.
- Added scripts/test-audit-local-database.cjs: rejects non-loopback URLs and requires a new groompro_audit_*_test database. Exercises the actual create/move code, not a mocked database.
- Fixed return-visit lookup using invalid VOIDED enum; voids already use CANCELLED plus their existing marker. Preserved all void history.
- Fixed saved portal retries failing against their own appointment. Tenant/customer scope and locked duplicate check retained.
- Staff create/move now recheck existing customer overlap warnings under the tenant transaction lock. Existing configured warnings and authorized overrides preserved.
- Real database tests passed: simultaneous portal requests, twelve competing requests, same-request retry, staff create/move concurrency, explicit override, multi-shop employee availability, schema recovery and full SQL dump/restore comparison. Log: ../audit-local-db/test-08.log.
- Cross-origin embedded UI passed fictional sign-in, saved-choice restoration, slot selection and review-request submission via keyboard controls. Browser click routing into the frame was unreliable; keyboard use completed the flow. No actual messages/appointments sent. Proof: ../embedded-booking-completed-review.png.
- Additional reviewed hints cover time correction, report location, visual controls, starter packages, imported item matching and POS date/time. Labels and saved behavior unchanged. Existing help on prepaid/promotions/tasks retained rather than duplicated.
- Audit now 115 resolved / 51 open. Seven formerly broad blockers closed (21,23,42,170,206,209,212). The 51 are 24 provider/host-dependent rows and 27 deferred/not-authorized rows. Native recovery checks completed; real host recovery/retention remains open.
- Nothing published. Final build result recorded separately below.

Final production build passed: ../audit-native-final-build.log. Temporary database and review servers stopped; generated TypeScript config restored. No publication.
