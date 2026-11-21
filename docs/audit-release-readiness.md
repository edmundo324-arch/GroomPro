# Current release readiness — November 19, 2026

The original 42 Missing / 124 Partial totals are audit baseline counts, not completion totals. The chronological work queue records implementation and test evidence; older pending notes there can be superseded by later decisions.

## Latest local additions

- Separate Refer-A-Friend rewards for the new and referring customer; editable invitation in the portal; first-paid-groom award timing retained; free-item redemption protected against reuse.
- Approved return-visit discounts and tenant weekday extensions, with main-package eligibility and date-change handling.
- Incoming email replies linked to the original customer/ticket, with signed callbacks and duplicate protection. Receiving requires the optional provider/host setup in `email-delivery-results.md`; no live receiving is claimed.
- Current VIP enrollment groups by start month and membership name. Pending cancellation/pause requests remain separate from ended memberships. This does not reconstruct missing past status transitions.

## Current continuation and remaining decision

- Cash/account-credit item refunds are implemented locally with proportional commission/tip reversals, tax, optional stock returns and separate reporting. Original closed sales remain intact. Focused checks passed; no real refund was issued.
- Shift shop assignments now drive online availability, Calendar and offline schedule edits. Existing shifts use the employee assigned shop or sole tenant shop; unresolved multi-shop shifts require a choice before being offered online. Cross-shop occupied employees are unavailable without exposing other customer records.
- Gift-card/prepaid purchase refunds default OFF, tenant-editable. Local code removes unused value/whole visits, allows gifting some/all visits, and offers the purchaser/recipient choice for gifted-visit refunds. Fictional refund-recipient UI review and focused refund/gifting checks passed; no real refund was submitted. Prior-balance collection lines remain outside item refunds.
- Remaining baseline gaps still need full reconciliation against the accumulated work. Original audit counts are not completion counts.

## Explicitly deferred or outside current authority

- Maps/traffic-aware routing and related live provider setup.
- Selected card processor, terminal/mobile collection, payment links, recurring charge/refund provider integration and settlement reconciliation.
- Shop-side .bak restoration and live 123Pet synchronization validation.
- Further Whiteboard layout changes.
- Custom automatic actions that change customer accounts/statuses, which the user explicitly tabled.
- Future Training Studio and Sales Studio functionality, which remains unauthorized.

## Verification limits

Focused tests and fictional local browser reviews do not prove production database concurrency, large-location load, every device layout, provider delivery, host backup recovery or live GoDaddy operation. No production customer records, messages or payments were used in these checks. Historical records missing source data are not reconstructed or presented as complete.

The user explicitly requested publication of completed changes on November 19, 2026. This release contains the completed local batch; it does not mark the entire audit finished.

Production build and type checking passed. Focused verification is recorded in the work queue, including 20 final refund/gifting/employee-report checks and six export/print checks. GoDaddy deployment and live provider operation remain unverified.

Pending decisions: the user requested explanation of custom-rule options; no new general rule builder was implemented. Employee utilization is to use actual grooming time divided by clocked hours; recorded breaks must be subtracted. Separate employee work timers were explained and await approval; dog-stage elapsed time is not treated as employee work, so the utilization ratio is not included.

## Local follow-up after b13a17b

Customer account change reporting now lists the existing owed/credit ledger by recorded date and accessible customer, with separate totals and CSV/print support. Fifteen focused checks and type checking passed; fictional desktop/narrow UI review passed. This follow-up is not yet published.


## November 20 local continuation — not a release

The user has instructed continued implementation without publication. The overall audit is unfinished. Productivity uses assigned item durations (not work timers); past days use worked hours minus breaks and today/future use scheduled hours. Refunded performed work remains included. VIP activity uses recorded event dates; historical retention is still incomplete.

Local work includes deposit-to-Customer-Credit recording, credit settlement corrections, store-credit-only factory refunds with tenant cash opt-in, unpaid-ticket voiding with retained history, account-funded no-show fees and a shared marketing limit (factory one per week). Production build passed for these local additions. Focused checks and limits are recorded in the work queue.

Custom rules currently save drafts only. Activation, execution, standard-message replacement and runtime history still need completion. Marketing classification is now approved: rebooking/promotions only. Partial-credit/saved-card handling uses credit first and charges the remainder; no-card remainder becomes Balance Owed. These latest card-reservation and custom-rule-plan additions passed focused checks and type checking after the preceding production build. Historical VIP retention must exclude paused memberships and remains unfinished. No live GoDaddy, provider or production-data verification is claimed.


Latest local continuation: historical VIP retention is implemented with explicit unavailable results for incomplete history. Appointment and VIP membership staff-task/notice rules have activation/pause and native execution; remaining custom events, customer-message replacement/delivery and runtime history are still unfinished. Focused checks and fictional UI review passed. No publication or live-provider verification.


November 20 local continuation: custom customer delivery and recent action/failure history are now implemented for the supported appointment and membership events. Booking messages remain separate from attendance confirmation; factory confirmation sequence unchanged. Overdue-task staff actions are supported. Closing replacement UI was reviewed with fictional records. Latest focused checks passed; overall audit and host/provider delivery verification remain unfinished. Nothing published.

Reports → Custom rule results now includes recorded deliveries and current staff-task completion, with CSV and printable output. Tests verify deduplication, unknown delivery states, date selection and customer/employee visibility. Desktop and phone previews used fictional data. Attribution to subsequent bookings is not yet implemented or claimed; its definition is pending user clarification.

## Current local status — November 20 continuation

All work after b13a17b remains unpublished. Earlier entries above are chronological and do not describe the final current scope. Customer replies, shop acceptance, rescheduling confirmation retention, deployment correction, and ticket follow-up stopping are implemented with focused checks. Clear standalone text/email replies are recognized; general AI/voicemail interpretation is not complete. The deployment correction has not run on live records.

Custom-rule results now count subsequent accepted bookings from any channel, not only message links. Current VIP retention and Productivity Report are implemented under the latest approved definitions. Sales/refund reconciliation is separate from prior sales calculations. The combined production build passed before the latest overdue-customer rule additions; those additions have focused tests and a further build underway. Pet/program eligibility and offline report-history scope require user decisions. Universal host/provider/load verification and the remaining approved audit gaps are not represented as complete.

The further overdue-customer production build passed. The subsequent current-owner guard and duplicate-hint correction passed focused tests/type checking and narrow-screen fictional review. Generated configuration was restored. Pending decisions include offline history scope, pet/program eligibility and retry behavior; general AI/voicemail handling and live host/provider validation remain incomplete.


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
