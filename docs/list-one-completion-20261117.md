# List One completion review — 2026-11-17

Published baseline before this work: e10cb5162b1f70d2b2735fbfc74ca0cb3bc03421.

| Agreed item | Implementation / where to test |
| --- | --- |
| Search fields in unopened modules | Blue menu → right-click → Search. Indexed destinations open the appropriate module/Settings section; record-specific fields wait for the employee to select the record, then highlight it. Search text remains until cleared. |
| Shared helpful wording | Shared field-purpose explanations and full Settings paths. Existing tenant hint visibility and highlight colors remain in use. Whiteboard wording/layout is unchanged. |
| Complete, stable forms | Customer/Pet/catalog/ticket/schedule lists keep their structure during retrieval. Compensation opens its fields before retrieval; incoming values reconcile with edits. Agreement Settings and message saves preserve later edits. Existing shared paper editors, neutral focus and saved window preferences remain. PIN focus is unchanged. |
| Location sharing | Settings → Locations & hours → Customer sharing. Review first-appointment suggestions or bulk shop moves, then save. Groups enforce customer-linked reads and writes, including Whiteboard, public intake and tablet retrieval. Platform access remains intact. Public links require a shop; imported new customers use the selected shop. Existing imports/matched customers do not silently move groups. |
| General import catalog matching | Settings → Data & integrations → Import & migration → Prepare missing catalog items. Review source-ID-based service/package proposals, create or match them, validate, then execute. Conflicting source prices/contents require review. Booked lines remain historical; usable catalog packages link to their component services. |
| Portable export | Settings → Data & integrations → Import & migration → Export business records. Owner/admin download of readable JSON, related IDs, source records, memberships, history and business settings. Authentication credentials/payment tokens are excluded. External pictures remain links. Unreadable older encrypted originals are explicitly reported. |
| Reports | Reports → date range/period, location and previous-period comparison. Receipts, closed-ticket sales, tips, service revenue, recorded commissions, membership starts/ends and referral sources. Membership current statuses are explicitly current, not reconstructed historical balances. |
| Calendar invitations | POS Ticket → ⋯ → download/email calendar invitation. Uses booked time/duration, stable event identity, existing tenant email configuration and customer email preference. Attempts recorded; uncertain outcomes are not silently resent. No new SMS or email provider is enabled. |
| Grooming quick picks | Settings → Service categories → Grooming quick picks. Reusable Body, Face/TBF, Ears, Tail and Special notes text appears in the shared grooming editor. Staff can edit inserted text; existing locks still apply. |
| Vendors | Inventory → Vendors. Contact details and existing-product associations, with tenant ownership checks and revision conflict protection. Does not place orders or alter stock. |

## Verification boundary

- Focused automated tests cover sharing query/request isolation and blocked references, import validation/catalog links, export redaction/parent relationships, report calculations, calendar content, agreement location propagation and navigation paths.
- Production build and rendered UI checks use the existing dependencies. UI review uses isolated synthetic records, not a tenant database.
- No live imports, customer moves, database migrations or real emails were performed.
- GoDaddy database execution and actual email delivery require verification after deployment. No claim of live-host verification is made.
- List Two / deferred items are not included. Whiteboard appearance and controls remain unchanged.
