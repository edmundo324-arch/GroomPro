# Shared application boundaries

Local modularity correction, October 2026. This is a maintenance guide, not a numerical modularity score.

- POS entry points use PosTicketWindow. Server booking, checkout, rebooking, membership, status, no-show and rewards actions live in src/lib/actions; API routes and composite POS operations call those same implementations. Keep durable operation keys and uncertain-payment handling intact.
- CustomerCreateWindow is only a compatibility adapter to CustomerProfile. CustomerEditor is the shared form. Inventory creation and Products use CatalogWorkspace. PetEditor remains the shared pet editor; GroomingNotes owns editing of existing permanent, original and dated grooming instructions.
- employeeFetch orders mutations by record identity. Include ticketId/petId/customerId in mutation payloads where available. Related writes remain ordered; unrelated records and reads run independently. Unidentified writes are conservatively ordered per endpoint. These queues are client-side coordination, not database transaction guarantees.
- withRequestPolicy applies authentication, explicit role denials and module entitlements at internal API boundaries. Existing handler-specific restrictions remain authoritative. Public integration/setup/session routes retain their specialized authentication. requestAuthorization reuses authorization only inside a single request; actionContext carries it through one composite POS action. Never cache authorization across separate actions.
- module-catalog defines navigation and module mapping. Missing configuration preserves default navigation; explicit server denials still apply. schedule-access and schedule-dates share employee/asset authorization and shift validation.

## Verification

Automated coverage includes same-record ordering, independent saves, queued-work context changes, one-time manager approval, per-action PIN consumption, tenant separation, module/role denial, and composite-action permissions. Existing domain regression tests continue to cover booking, packages, notes, schedules, Whiteboard and payments. Use browser checks as well as the production build before publication.

## Boundaries intentionally retained

Business-specific editors and database tables remain separate where their responsibilities differ. Module visibility is not authorization. Permission records that have not been configured retain existing handler defaults; explicit denials are enforced centrally. No new billing provider, Training Studio, general migration framework, or architectural rewrite is part of this correction.
