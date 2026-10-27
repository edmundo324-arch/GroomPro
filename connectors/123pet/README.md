# 123Pet connector — current verification status

This integration is under development. Do not describe it as a complete migration
or enable production writes on the strength of a successful read scan.

## Running locally

1. An Owner or Developer creates a connection in Settings → 123Pet connection.
2. Run `Save-ConnectorCredential.ps1` under the Windows account that can read the
   SQL Server database. It stores the connector credential using Windows DPAPI.
3. Run `Start-Connector.ps1` with the GroomPro origin and credential-file path.
   HTTPS is required except for a loopback development server. SQL Server does
   not need an inbound internet port.
4. Leave the connector running. It scans every 30 seconds after completing the
   previous scan. Restart it after updating its PowerShell files.

The current local launcher is outside the repository. Credentials, schema
reports, and compatibility profiles must remain excluded from Git.

## Verified on the current source

- SQL Server 2012 Express, compatibility level 110. Change Tracking and CDC are
  not enabled; the connector uses ordered complete scans with encrypted source
  snapshots and fingerprint deduplication.
- Customers, pets, catalog and employee records have been received repeatedly.
  Customer ownership is resolved by source IDs. Existing ambiguous matches are
  retained for review. Imported staff do not receive working credentials.
- The Settings connection panel shows counts and explicit record matching.
  Linking an employee does not replace access, PIN, or existing profile details.
- Ticket mapping tests cover source clock preservation, unrelated/duplicate-line
  rejection, totals, replay, and immutable payment correction handling.
- No 123Pet source records have been changed by the connector.

## Ticket processing

Only `TICKET_BUNDLE` messages can project tickets. Separate header/line scans are
retained as source evidence, not treated as a coherent ticket. The connector
reads each header and its lines inside a short read-only serializable transaction
and releases SQL locks before sending the bundle over HTTP.

GroomPro uses one tenant-locked transaction for projection and acknowledgement.
Native snapshots protect against overwriting local edits. Source line removals,
payment changes, paid-ticket financial corrections, ownership changes, and
restoring voided tickets go to review. No ticket, line, pet association or payment
is deleted by the projector. Successful projection signals retained modules to
refresh in the background.

## Remaining verification / compatibility gaps

### Current demo direction (latest user instructions)

GoDaddy GroomPro is the authoritative demo source. The PC GroomPro database is
not the transfer source. Add/update the local SAMPLE 123Pet database and retain
unmatched 123Pet records. The user explicitly declined a 123Pet backup; preparation
must not require or create one. `Prepare-DemoTransfer.ps1` now reads metadata only.

For Rubber Doggies and future real tenants, initial setup runs from 123Pet into
GroomPro, preserving 123Pet as authoritative. Writes back remain disabled until
initial import reconciliation and operation-level compatibility are verified and
separately authorized. A connection never enables outbound writes automatically.

### Deployment and setup

1. Deploy this code to GoDaddy using the normal GitHub sync.
2. In GoDaddy GroomPro Settings, an Owner/Developer creates a Test connection and
   chooses `This GroomPro site to 123Pet (demo)` as the initial source. This keeps
   inbound record updates off. A new tenant connection defaults to 123Pet first.
3. Download the Windows connector ZIP from that same Settings section. It includes
   scripts only, never credentials, captured data, or SQL metadata reports.
4. Extract it and run `Setup-Connector.cmd`. Supply the stable HTTPS GroomPro site
   address and its connector credential. Credentials are bound to that origin and
   protected with Windows DPAPI. Do not use the PC localhost as the demo source.
5. Run `Start-Connector.cmd` under the Windows account with SQL Server access.
6. `Prepare this site's demo data` freezes a tenant-scoped, encrypted snapshot on
   the GoDaddy server, including customers/pets, employees (no PINs/access roles),
   catalog/packages, tickets, payment history (no processor identifiers), and
   grooming notes. Incoming 123Pet-created records are excluded to prevent loops.
7. The connector downloads the current snapshot into DPAPI-protected local chunks
   for compatibility review. This does NOT insert records into 123Pet yet.

The complete outbound insert/update executor, package/membership compatibility,
financial business-rule verification and final reconciliation remain unfinished.
This deployment is the connection/data-staging prerequisite, not completion of
live two-way synchronization. SQL execution success alone does not verify that
123Pet can use the imported records correctly. No source records have been written.

The earlier `123pet-demo-preflight.cjs` inventory was local diagnostic data only;
its counts must not be treated as GoDaddy's current authoritative record counts.

- The updated bundle reader delivered all 111 source tickets on October 26, 2026.
  They remain in review, rather than being assigned to guessed employees.
- Ticket employee references must be confirmed against the displayed 123Pet
  employee. The source has separate `fldPK` and `fldEmployeeID` fields and no
  declared foreign keys. Do not guess which one ticket rows reference.
- The five user-approved employee matches are linked, retaining existing names,
  PINs and access. The two catalog matches still require reconciliation.
- The user identified ticket #1000's employee as Demo Employee, but that name is
  absent from the received employee table. Its line reference 10 matches neither
  an employee logical ID nor that name; employee primary key 10 is Zagla Maria
  Saenz. Confirm the source company and reference semantics before proceeding.
- A nonstandard ticket type and missing/zero pet references need verified rules.
- Packages and membership definitions are staged but do not yet project into
  operational packages/billing. Their test source tables currently contain no
  examples. Membership payments, billing behavior, grooming-history semantics,
  complete profile/contact fields, and source deletions are not fully mapped.
- Multiple destination locations require explicit location mapping; current
  ticket projection stops for review when the tenant has more than one location.
- Browser refresh notification is implemented; end-to-end ticket refresh still
  needs a confirmed live bundle and employee mapping.

## Write boundary

Writes are disabled by default. The outbox supports allowlisted customer-contact
and pet-instruction operations with expected-value comparisons and stable request
IDs. The SQL executor requires a separately installed and verified receipt table;
it will not create source schema automatically. It cannot accept arbitrary SQL.

No write operation has passed 123Pet business-compatibility verification. Write
activation therefore remains unavailable. SQL execution success alone is not
verification. Operation-level evidence must match the source schema fingerprint;
production additionally requires separate explicit authorization. Uncertain
financial outcomes must never be blindly retried.

The full two-way workflow and complete migration remain unfinished until these
gaps are resolved. Nothing in this status document authorizes production writes.
