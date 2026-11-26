# Optional business subdomain routing

Status: preparation approved for GitHub publication on November 26, 2026;
routing remains disabled by default while the domain is undecided. No DNS,
certificate, hosting setting, database record or sending address has been changed.

## Current site preservation

When `GROOMPRO_SUBDOMAIN_ROUTING_ENABLED` is absent or not exactly `true`, the
existing preview/custom addresses, business selection, sign-in and APIs retain
their current routing. There is no new dependency or database migration.

## Configuration for a later approved deployment

Use the chosen domain and real existing business IDs, not the examples below.
Keep the routing flag off while preparing and testing the configuration.
`GROOMPRO_SUBDOMAIN_ROUTING` is a server-only JSON setting:

```json
{
  "baseDomain": "example.com",
  "businesses": {
    "rubberdoggies": "pilot_existing_business_id",
    "happypaws": "pilot_another_existing_business_id"
  },
  "legacyHosts": ["app.example.com", "existing-project.preview.c38.airoapp.ai", "localhost"]
}
```

`legacyHosts` must include every existing address that should still serve this
installation, including the actual published and preview hostnames. List hostnames
without protocol, path, token or port. This is an explicit allowlist once enabled.
Business labels are lowercase single DNS labels. Reserved names such as admin,
dev, staging, app and www cannot be assigned to a business. Shared addresses can
be explicitly listed in legacyHosts but doing so does not create separate sales,
admin, development or staging environments.

The Host header is used. X-Forwarded-Host is not trusted. Before activation,
verify that the host forwards the original public Host header. If it does not,
a trusted-proxy arrangement needs implementation and verification first.

## Behavior and boundaries

- The app's existing startup request resolves the mapped business and sets only
  its existing host-only business cookie. It never creates an employee session.
- Employee PINs, device verification, permissions, restrictions and existing
  business checks remain required by their existing handlers.
- Unknown hosts, conflicting business cookies/headers/query selectors and
  mismatched customer-portal/device-opening body selectors are rejected.
- Explicit address-routing denials do not trigger the app’s generic offline
  fallback. Do not reassign a used hostname to a different business without
  retiring the old browser/device data; disconnected devices cannot learn a new
  server mapping until they reconnect.
- A missing mapped business never falls back to the original GroomPro workspace.
- Public form handlers retain their own token/phone verification. Existing
  public URLs and message origins are not rewritten automatically.
- Platform Owner/Developer business switching remains on the existing shared
  GroomPro address. Sessions are not copied between subdomains. Authorized
  existing platform controls are not removed from the shared site.
- Admin/dev/staging isolation, new sales pages, cross-domain SSO, automatic DNS
  provisioning and automatic business-name allocation are not part of this
  routing preparation. The explicit map is maintained in deployment settings.
- Roll back routing by removing the enabled flag; no data rollback is necessary.

## Activation checks (after approval)

1. Choose the final registered domain and confirm the precise hosting plan.
2. Confirm wildcard hostname routing and wildcard HTTPS support, or confirm that
   individual tenant hostnames can be attached and certified automatically.
   A wildcard DNS record alone is not enough.
3. Prepare independent development/staging databases and production deployment
   controls; a subdomain alone is not environment isolation.
4. Test two mapped businesses and the original address on a test deployment:
   fresh browser bootstrap, PIN/device enrollment, owner support access, customer
   portal, employee sign-out, wrong-business selectors and unknown hostnames.
5. Verify the host's Host-header forwarding, HTTPS, callback endpoints, worker
   requests, retained preview hosts, and tenant-specific public message origins.
6. Enable only after those checks and explicit publication/hosting authorization.

## Hosting confirmation pending — November 26, 2026

The later signed-in GoDaddy cart inspection identified Web Hosting Deluxe.
Nothing was purchased or changed in the hosting configuration. GoDaddy documents
Node.js hosting and automatic HTTPS under this plan, and an API for attaching
individual custom subdomains to the same application:
https://developer.godaddy.com/en/docs/api-users/hosting/attach-domain

Support case 02211043 requests written confirmation of per-app subdomain limits,
automatic signup provisioning/DNS requirements, and included SSL issuance and
renewals. No substantive reply has been verified yet. Do not treat the plan's
10 application slots as a confirmed 10-business limit, or cPanel's subdomain
allowance as proof of the Node.js platform's allowance.

The user approved publishing this preparation with routing OFF because the final
domain is still undecided. Activation and automatic provisioning remain pending
the final domain, hosting confirmation and the activation checks above.
