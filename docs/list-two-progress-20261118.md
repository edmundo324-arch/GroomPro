# List Two implementation — November 18, 2026

## Implemented in this batch

- Customer portal: phone verification, appointment viewing, contact/pet profile edits with revision checks, signed agreements and intake links, booking and change/cancellation requests. Tenant chooses automatic booking or shop review (factory default). Assets default to online availability; employees opt in, and both have an Available online setting.
- Cancellation: 30-hour factory notice, tenant-selected hours/days and customer wording, existing same-day/no-show fee reused. Late requests preserve the booking, record request time and use configurable red/white appearance. Staff can assess or waive the fee. Same-local-day moves incur no fee; different-day moves follow the rule. Reviews reject stale appointment changes; retries do not duplicate charges.
- Device authorization: first device requires a code sent to the business owner's email. After the first approval, the tenant chooses email code or password for subsequent devices. Shared owner emails can select among verified businesses. Platform Owner/Developer access remains available. Existing role/location protections remain.
- Offline expansion: service/package editing, recurring and date-specific employee/asset schedules, and time clock use the existing offline queue with revision/conflict checks. Prepared Calendar resource schedules reflect pending changes. Reports opened online are saved for the exact location/date/comparison query.
- Customer identity: new records require a valid phone; duplicate normalized phone numbers reuse the existing customer, including inactive records. Matching names/emails alone do not block a different phone. Existing records and imports are not rewritten.
- Time clock: clock in/out, breaks, manager corrections with reason and audit, offline recording and sync. Elapsed, break and excluding-break durations are separate; no payroll policy was invented.
- Tips: post-checkout additional tips record money already received. Manual allocations and equal Split use cent-accurate totals and audited, idempotent saves. Existing checkout behavior is preserved.
- Pet families: one current customer/family per pet, unlimited contacts on the customer, unlimited transfers to an existing or newly created family. Transfer preserves pet ID, notes, original ticket customers and financial history, records each transfer, and rejects stale ownership/access violations. Save pending pet edits before transferring. Transfer requires connectivity.
- Pet history: current family can see the pet's earlier grooming history within existing business/location permissions. Open ticket is available in grooming history; a paginated ticket history includes tickets from previous families. Historic tickets keep their original customer and charges.

## Intentionally deferred by the user

Whiteboard layout, payment-processor selection, shop-dependent 123Pet backup/live-sync work, and Maps. Existing Whiteboard sharing restrictions are unchanged. No simultaneous co-owner accounts or customer merge workflow was added; the user clarified one family per pet and phone-based duplicate prevention instead.

## Verification and limits

Focused tests cover portal scope/revisions, cancellation requests and moved appointments, online availability, device approval/passwords/platform access, time-clock rules, offline projections/replay, phone identity, tip allocation/payment retries, repeated pet transfers and history across families. Prior legacy PIN suite failures were reproduced at the unchanged starting commit; the relevant new-device/platform checks passed.

Production build and type checking passed. Transfer tests passed (2); history-route and existing grooming-rule/default tests passed (9). Synthetic local UI fixtures exercise the portal, devices, clock, tips and cancellation reviews without changing live data or sending provider messages. Final browser checks confirmed transfer selection/completion, removal from the previous family, and opening the historical POS ticket.

Offline reports are saved snapshots, not newly calculated reports from unsynced activity. An unprepared report query still needs a connection. Provider email/SMS delivery and the final GoDaddy deployment require verification after syncing. No production migrations, customer-data changes, messages or card charges were performed during development.
