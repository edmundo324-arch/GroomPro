# GroomPro consolidation project — 2026-10-04

Baseline: GitHub 7075014. Preserve Calendar search, shared editors, ticket actions, accounts, pets, location pricing and floating POS.

## Inspection findings
- One POS component already exists. Unsaved package rows are not expanded until server save; consolidate the line resolver rather than build another ticket screen.
- Customer Profile is shared, but optional navigation callbacks are missing from Pets/POS/Whiteboard entry points. Route all entry points through shared navigation events.
- Account adjustments store reasons in CustomerAccountLedger; the profile ledger currently reads audit entries instead. Show both, not a replacement of either history.
- Communication records are shared, but the generic send API records sentAt without delivery. No Twilio sender exists. Preserve history; make actual delivery explicit and tenant-scoped.
- Service.description is already report-card-capable text. Add service code, not a competing description field. Keep legacy commission percentage during transition.
- TenantSetting already stores JSON; use validated shared settings rather than parallel settings tables.
- Bootstrap adds missing columns and tables without dropping data. Existing enum/index changes require explicit migration handling.

## Phase status
1. Additive schema foundations and per-header classification completed. Sensitive import fields remain deferred; no customer/pet production import performed.
2-10. Shared POS/profile navigation, service metadata, PIN policies, timing, package toggles, contacts/ledger/report cards, VIP enrollment, ticket ranges and calendar presentation implemented and locally verified. Provider-dependent delivery and recurring billing remain subject to the deployment boundaries below.
11. Existing Whiteboard preserved. After foundation tests passed, its VIP action was connected to persistent pet eligibility, with membership checks and a pet lock. Closed-ticket mutations are blocked. Existing service assignments continue to feed shared POS commission finalization. No separate Whiteboard architecture was introduced.

## Questions
- Confirmed: last 30 calendar days, divided by days actually worked; automatic threshold changes initially, tenant may require manager approval later.
- Confirmed: upgrade legacy PIN prefix verification at next sign-in without changing the PIN. Active legacy records must upgrade before new prefix-sensitive assignments. Reactivation requires a newly checked PIN.
- Attendance source: completed grooming visits establish worked dates; manager-recorded dates include work with zero dogs. Do not count scheduled shifts as proof of attendance.
- Remaining external verification: live MySQL and SMS provider configuration are not available locally.
- Imported credential/token fields and SSNs are not imported into ordinary profile/legacy JSON. Retain identifiers only after mapping review.

## Verification
No live GoDaddy/MySQL verification for this project yet. No customer production imports or outgoing messages performed.

## Verification to date
- Production build passed (Next.js 15.5.25), schema SQL generated; cache snapshot warnings are nonfatal.
- Type check passed after messaging webhook and read-only checkout changes.
- 74 regression tests passed, including security/contact/package behavior, membership fees and billing timezone boundaries, messaging signatures and legacy service corrections.
- Local browser uses synthetic fixtures only. Never equate fixture persistence with GoDaddy verification.
- Release prepared for GitHub publication; deployment must be verified separately.

## Deployment boundaries
- Three production builds passed. Final compensation approval now recalculates against the newly saved rules and worked dates in the same transaction; 74 regression tests and final type checks passed.
- GoDaddy hosting URL currently redirects to sign-in in the available browser. A user sync/redeploy will be required unless the hosting session becomes authenticated.
- Live table creation/data preservation, real provider delivery and real recurring billing are not claimed as verified by local fixture tests.
- Service correction runs only for the exact Rubber Doggies Grooming tenant name and retains original values in ImportRecord. Other tenants are untouched; ambiguous duplicate codes are skipped.
- Profile -> POS from Pets originally left the profile open; browser regression found it and the retest confirms exactly one dialog.
