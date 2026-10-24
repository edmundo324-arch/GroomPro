# Appointment preferences and starter packages

Settings → Business workflow & personalization contains the shared nearby-appointment warning policy (14 days, same pet initially), override roles/individuals, window-position preference, history sorting, colors/borders/gradients and live popup preview. The existing CalendarHover component is reused without changes. Warning acceptance is checked again on the server. Non-scheduling failures remain non-overridable.

Custom status labels map to existing visit stages so check-in/ready workflows continue working. Closing/payment and cancellation retain their existing controls. Custom service designations control presentation independently of booked line items.

Employee appearance customization is off initially. Administrators grant it by role or employee. Personal overrides are stored under that tenant and employee, and returning to tenant defaults removes the personal overrides. Appearance and application reset actions are separate; neither deletes business records.

The optional Starter package library imports service dependencies with package quantities and production roles. Existing appointments are not repriced. Compare before importing; choose Skip, Replace, or Add as new for each package. Library publication and cross-business transfers require an ADMIN employee whose ID is explicitly listed in GROOMPRO_PLATFORM_ADMIN_IDS. This allowlist must be configured by the installation owner; ordinary tenant administrators cannot grant themselves platform authority.

PlanFeature stores published plan entitlements. Existing subscriptions without configured plan entitlements retain their existing access. STARTER_PACKAGES is the entitlement for tenant self-service library imports. Platform overrides are recorded in TenantFeature config and cannot be changed by tenant users. Free published plans can activate immediately. Paid activation is intentionally blocked pending the Fiserv billing integration and defined plans/prices; it does not pretend to charge or activate paid access.

Schema deployment uses the existing generated SQL/bootstrap workflow. No starter packages, customers, pets or appointments are added to new tenants automatically. Library content is supplied explicitly by a GroomPro administrator from working packages.


## Manufacturer appointment colors
The approved initial palette ships in `src/lib/calendar-presentation.ts`, so GitHub/GoDaddy deployment uses it without a data import or schema migration. Settings → Appointment presentation retains tenant controls for fill, text, category border and gradient. **Set to manufacturer colors** restores only the palette; popup fields, timing, security and other preferences remain unchanged.

**Save as manufacturer colors** is available to GroomPro platform administrators listed in `GROOMPRO_PLATFORM_ADMIN_IDS` (employee IDs, comma-separated), not ordinary tenant admins. It validates and saves the palette in the reserved `TenantSetting` row `groompro-manufacturer-colors`, owned by the publishing platform tenant. Keep that platform tenant; deleting it removes its stored preset. Existing explicit tenant palettes remain unchanged until restored. New/unset styles inherit the manufacturer palette. Local database customizations do not transfer through GitHub: save later custom manufacturer palettes on the deployed installation too. The initially approved colors are bundled in source.

Ready uses a category base with a strong pastel-green overlay and category border. Called/texted after Ready removes the border. A successful outbound communication associated with the ticket, subject `Ready for pickup`, and sent after `pickupAt` identifies that contact stage; queued, failed and unrelated messages do not. This appearance update does not add a phone-call or Whiteboard messaging workflow. Those actions must record this association when implemented.

A service explicitly marked `customFields.requestOnly`, coded `REQUEST`/`REQUEST_SERVICE`, or named `Request`/`Request Service` is a request placeholder. Zero price alone never makes a booked service a placeholder. Active VIP membership takes category priority; otherwise the configured new-customer period and booked grooming classification apply.
