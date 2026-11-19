# Approved capability audit — remaining work

The original audit counted 42 missing and 124 partial entries. Those are baseline counts, not the current completed/remaining count. Published batches do not mean the entire audit is complete.

## Decisions and boundaries

- Continue approved independent work without another Continue or GoDaddy sync.
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

## Customer portal message choices — current continuation

- Verified customers can view/change Appointment emails and Appointment texts in their portal. These are the existing Customer Profile fields, not duplicate preferences. Customer identity comes from the verified session, never a submitted customer ID.
- Customer updates cannot change invalid-contact flags, SMS consent on individual phones, other customers, balances or unrelated profile details. Existing automated delivery checks continue to enforce all restrictions; explicit requested receipts/agreements retain existing behavior.
- Stale saves ask customers to review saved choices. Late loading preserves input entered while the request was running. Changes are recorded in the existing customer audit history; no schema or provider changes.
- Ten focused route/service tests and the production build passed. Fictional browser review verified existing choices, saving/reopening email-off, and an adjacent highlighted helpful explanation. This advances audit 121; live hosted delivery remains unverified.

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
