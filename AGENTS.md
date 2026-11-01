# GroomPro product requirements

- Design for busy human employees and business owners, not AI agents. Group settings by the user's task and familiar entities (Ticket information, Customer information, Pet information). Use readable labels, spacing, and progressive disclosure instead of dense field dumps. Put short explanations behind accessible question-mark help controls. Verify the rendered interface, not just the code. Preserve approved layouts and the “Less clicking is more productive” rule.

- Preserve working functionality and navigation. Requests are additive unless the user explicitly asks to change, move, or remove a specific capability.
- Preserve Calendar search behavior exactly unless explicitly requested otherwise.
- Keep Calendar directly accessible from the main menu. Do not hide modules because feature configuration is missing or uses a different response field.
- Keep existing Customers, Pets, Tickets, Whiteboard, Messaging, Inventory, Reports, catalog, Schedule, and Settings navigation available by default.
- “Push Date to Whiteboard” belongs on Calendar and uses the selected Calendar date.
- Less clicking is more productive: request an employee PIN directly when an action needs one; avoid unnecessary navigation, confirmations, and modal chains.
- Check navigation with a populated feature API response, not only empty fixture data.


- Use one shared editor per entity (employee, customer, pet, booking asset, catalog item) wherever editing is offered. Do not create separate competing versions of the same module.
- Pets belong to customers. Preserve that link in forms and imports; never guess ownership from a pet name alone.
- Keep package editing focused on included items with quantities; use search to add services rather than showing the entire catalog.

- All new ticket, appointment, and scheduling actions use PosTicketWindow. Unsaved and saved tickets must use the same POS Ticket screen and item editor, not separate forms; do not introduce separate appointment modules or return users to a list after creation.

- Clicking a pet inside POS adds its assigned package, or its breed default when unassigned. It does not open pet editing. Pet editing stays in the shared customer/Pets editor.

- Choose Related Files supports linked customer, pet, and appointment imports. Preserve ownership, source-identifier duplicate protection, and booked line-item details without requiring employee-profile or service-catalog imports.

## Future Training & Sales Studio compatibility (no implementation authorized)
- Preserve stable, identifiable interface elements and accessible names for future Playwright workflow recording.
- Reuse centralized feature definitions, tenant settings, subscription permissions, and role-based access controls wherever practical.
- Keep future development-team-only Training Studio and personalized AI Sales Studio compatible with the architecture. Proposed tooling includes OpenAI services, Playwright, and FFmpeg; do not add dependencies or functionality for these modules yet.
- Future automation must use a dedicated demonstration tenant with fictional data and retain tenant isolation and permission checks.
- Prioritize current functionality and approved appearance. Do not rebuild or interfere with working features solely for future Studio compatibility.

## Desktop-first and Mobile Groomer development
- Desktop owners/managers remain the primary audience. Preserve the approved desktop layout and workflows.
- Mobile Groomer is a future touch-oriented staff experience, with its own navigation/layouts when appropriate; do not squeeze complex administration into a phone or start a full mobile redesign now.
- Share server application services, database models, scheduling rules, permissions, tenant/location isolation, validation, and transaction safeguards across both experiences. Never fork business rules by screen size or user agent.
- Build new shared controls with bounded widths, wrapping, keyboard access, and touch-compatible interactions. Address basic responsiveness in existing controls when touched, without disrupting desktop behavior.
- Before a significant mobile-related architectural change, document desktop impact and explain material tradeoffs to the user.
- See docs/desktop-mobile-strategy.md for the current boundaries and review criteria.

## Permanent UI restore point (already completed; do not repeat)
- Tag `GroomPro-Before-UI-Refinements` permanently identifies commit `26b06d0450bd55b886714949aa8d06a21f3c85a4`. Never move, replace or delete it.
- Verified Git bundle, installed dependencies/build/configuration archive and rollback script live privately at `C:/Users/Edmun/Documents/Codex/GroomPro-Restore-Points/GroomPro-Before-UI-Refinements`. Never publish private runtime archives or modify these read-only artifacts.
- UI rollback restores a separate checkout and does not restore, delete or migrate customer data. If future work needs database changes, take and verify a separate database backup first.
- Reuse completed findings, inspect relevant code only, keep tool output concise and run focused tests with necessary verification only.

## Agreed ticket workspace (October 31, 2026)
- Desktop POS stays a stable paper-like form. Appointment and payment controls remain visible; only phone uses Details, package Show/Hide, compact actions, and More tabs. Retain Edit Customer, Change Customer and original line edit handlers.
- Factory tab order: Items, Rebook, Notes, VIP Memberships, Account & Rewards, Report Card, History. Tenant layouts are in WORKFLOW.posLayout, independently for desktop/phone. Customize intentionally in Settings, not by dragging daily-use controls.
- Planned employees belong to each dog by default, optionally each package. Separate planning metadata from actual Prep/Bath/Dry/Groom line employees. The Calendar projects matching dog/package contents and sends unavailable planned employees to Unassigned/Other.
- Per-dog headings show actual package names and the dog's complete subtotal / tax-inclusive total, excluding tip. Never add a duplicate charge or per-dog payment ledger. Allocate the actual ticket tax with cent-accurate rounding. Existing ticket/manual tax stays unchanged; tenant-controlled new-ticket rate defaults to 8.25 percent.
- The desktop Calendar sidebar has three months, collapse-to-icon navigation and scoped preferences; tenant settings choose visibility, available items and their order. Date navigation never silently moves a ticket.
- Continue preparing a publication commit and PowerShell command for the user. Do not push automatically.

- POS pet strip lists all customer pets independently of attendance, with visible overflow navigation. A pet-name click toggles only its assigned grooming package; Self Service, other packages, offers, add-ons and products remain. Items and attendance/history derive from booked pet item lines, never from the customer pet list. Do not create empty pet item sections. Keep historical grooming records even when current appointment links are removed.

- Undo check-in clears only that ticket’s arrival priority. Each booked pet has its own Calendar block, including simultaneous same-employee bookings. POS booking choices show active pets only. Customer/Pet Profile Settings own the Show Inactive business default; profile/list overrides are local to the current instance and never reactivate a pet.

## Visual configuration and business timing
- A confirmed business timing save updates every non-terminal ticket and draft atomically, recalculating durations. Preserve closed/cancelled/no-show history; new bookings/rebookings use the business selection.
- Settings visual customization reuses live module controls. Tenant Admins may arrange existing controls/sections and change labels/colors; only PLATFORM_OWNER and DEVELOPER may alter control/section sizes, enforced by the API. Floating-window resize preferences remain independent.
- Visual configuration history keeps five complete snapshots per business/module, covering desktop/phone and existing POS placement or Calendar appearance settings. Restoring appearance never changes tax, prices, timing rules or ticket data. Do not store preview DOM, customer data or authentication material in layout history.

## Touch Calendar, per-dog timing and flat Items
- Desktop Calendar retains hover-to-preview/click-to-open. Touch uses tap-to-open, hold-to-preview (Open/X), and a separate drag grip; preview and POS are mutually exclusive. Hover/hold outlines all blocks on the same ticket.
- Calendar dragging changes only the dragged dog's planned employee. Same Time moves all ticket times together; Add Up Time moves only that dog's times, permitting gaps/overlaps. Actual responsible Groomer/Bather assignments override planned placement and disable that dog's dragging; other unassigned dogs remain draggable. Planning never rewrites actual service employees or commissions.
- Explicit line starts use tenant-scoped TICKET_LINE_STARTS metadata and per-date Calendar indexes, without schema changes. Same-day moves skip nearby-visit warnings. Appointment starts must be within business hours, while durations may finish after closing.
- Items are flat in all views. Keyboard Delete is bound to an intentionally selected dog's captured lines and never advances to another dog automatically. Package service removal asks Keep Discount/Remove Discount by default; tenant defaults are in POS ticket settings. Reprice only the remaining services in that dog's package using regular location prices, preserving actual employees and auditing price/commission changes.

## Compact Calendar and app installation
- Calendar heading and New POS Ticket are factory-hidden; tenants may enable them in POS layout settings. Empty employee slots continue the existing booking workflow.
- Small-screen Calendar keeps date navigation and search visible; secondary controls use the three-dot menu. Time Block / To Whiteboard are concise labels. Clear empties live search without reloading data.
- Phone/tablet column defaults are 100 px; scoped user choices override defaults and survive reopening. Touch item fields show ordinary text until activated, while desktop keeps its original native editors.
- The standalone web-app manifest uses a stable root launch URL without preview tokens. Installation shares live application services and permissions; no offline customer/payment caches or separate app business logic.
