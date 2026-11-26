# GroomPro product requirements

- GroomPro's original Platform Owner workspace is exempt from owner-email device enrollment for employee PIN sign-in, including limited testing employees. New tenant businesses still require device verification. Identify the original workspace by its native active Platform Owner record, never its display name or a linked platform operator; preserve PIN checks and employee permissions.

- Use Title Case for new or revised module titles, field titles and buttons, including the owner's spelling “PrePaid Packages” and “Add PrePaid”. Preserve tenant-authored names and previously approved terminology. Catalog search controls must accept typing and filter as the person types, including available plain-language descriptions. Combined item lists should default to All selected and offer independent type checkboxes so staff may choose any combination; do not convert unrelated setting choices into search controls.

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
- Planned employees belong to each dog by default, optionally each package. Separate planning metadata from actual Prep/Bath/Dry/Groom line employees. The Calendar projects matching dog/package contents and sends unavailable planned employees to Unassigned/Other unless an authorized scheduling exception matches that dog, employee, location, start and duration. Approved appointments remain visible under their employee, including with Working Only enabled; never change drop-off times or general staff hours to display them.
- Per-dog headings show actual package names and the dog's complete subtotal / tax-inclusive total, excluding tip. Never add a duplicate charge or per-dog payment ledger. Allocate the actual ticket tax with cent-accurate rounding. Open appointments recalculate tax from the saved business rate; closed tickets remain unchanged. Manual adjustments remain available. The factory rate is 8.25 percent.
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


## Universal human-friendly communication standard
- All hints, field help, errors, warnings, confirmations, notifications, generated messages and customer communications must sound like a knowledgeable grooming coworker. Explain purpose, useful action or what happens next; never merely describe a checkbox, dropdown or other control.
- Employee-facing wording is direct and feature-focused. Customer-facing wording may explain a relevant benefit, without inventing outcomes or adding sales claims. Keep both short, natural and specific.
- Use names, dates, appointments and membership information only from the appropriate current record. Format dates in the business/location time zone when available. Do not claim that saving, sending, delivery or another action succeeded unless its result confirms that claim.
- Preserve tenant-authored language and communication preferences. Do not rename labels, fields, tables or modules unless explicitly requested. In explanations use full navigation paths, including Settings → Calendar & Workflow → Appointment Appearance.
- Wording changes do not authorize changes to features, settings, permissions, workflows, stored preferences, calculations, retries, override decisions or business rules. Some existing server strings are protocol markers for PIN and scheduling handling; keep those intact and improve presentation separately.
- If a field’s business purpose is unclear, inspect the relevant behavior and ask the user before inventing guidance. Unreviewed fields may expose their existing search location, but must not invent a purpose based on their input type or a loose name match. Track unresolved meanings rather than claiming universal wording coverage.
- Before approving copy, check usefulness, natural tone, accurate context, workflow meaning and unnecessary words. Review actual message output; test dynamic wording and protocol preservation where relevant.
- Whiteboard remains excluded under the user's explicit instruction. No new AI/customer-message sending capabilities are authorized by this wording standard.

- Historical notes means imported customer notes that GroomPro could not match to an existing GroomPro note field. Do not rename it or change import mapping as part of wording work.
- Helpful hints prefer the right or left of their associated field, highlight that field without changing layout, and must not cover it. On narrow displays use available adjacent vertical space when neither side fits.

- Helpful-hint highlight color belongs to the tenant under Settings → Calendar & Workflow → Helpful hints; factory default is gold (#c18b16). Preserve the choice across sessions and apply it consistently to shared hints.

## Continuing approved audit implementation
- Continue the remaining approved capability-audit work after completing each batch; do not end work merely because a commit was published, or require another “Continue” or GoDaddy sync to resume independent work.
- Stop dependent work only for an unresolved business-rule decision, a concrete blocker, a user-requested pause, or an execution limit. Continue independent approved work while awaiting answers.
- Clearly distinguish batch completion from overall audit completion. Never claim to continue after ending a turn; report any actual interruption truthfully.
- The user explicitly authorized publishing all agreed changes to GitHub; that authorization supersedes the older publication-command-only instruction for this audit work.

## Publication cadence — user correction November 18, 2026
- Continue the remaining approved audit work without stopping after small batches.
- Keep unfinished work local. Do not publish small intermediate batches or ask the user to sync GoDaddy repeatedly.
- Hold the next GitHub upload until the agreed work is complete and checked, unless the user explicitly requests an urgent release. Prior blanket publication authorization does not override this newer timing instruction.
- Ask only for necessary unresolved business rules; continue independent approved work while answers are pending. Do not imply background work continues after a turn has ended.

## Continuous approved work — reinforced November 20, 2026
- Finishing a batch, test run, or progress update is not a reason to end the turn. Continue directly to the next unfinished approved item. Do not require another Continue from the user.
- Keep implementation local while the user's no-publication instruction remains active. A progress report is not an instruction for the user to sync or review an incomplete release.
- Ask concrete, example-based questions only where an unresolved requirement blocks dependent work; continue independent approved work. Preserve the existing functionality/conflict protection rule.
- If a genuine execution limit or external blocker forces an interruption, state exactly what remains and never imply work continues in the background after ending the turn.

## POS corrections approved November 22, 2026
- Status opens a floating searchable picker from the Status label. Package selection floats too; initially show eligible packages, search all available packages when typing, and retain eligibility validation. Neither picker shifts the ticket form.
- Offer Today is a compact persistent floating window; default dog choices have service lines on the ticket, and Show All includes every customer-owned dog (inactive dogs remain unavailable for new booking).
- Ready for Pick-Up reminders keep names and Ready @ time/date on one row. A contacted reminder can be dismissed for all devices at its location without changing appointment or communication history; a new completion creates a fresh reminder.
- Header arrival display is Order [number] | In @ [time], with a separate actionable Check-In control. Customer Notes hover shows permanent notes and warnings. Picture placeholders belong in the remaining space to the right.
- Ticket Tips carries the entered amount, includes service-line and package-assigned employees, offers Equal Split, tenant role-based % Split and manual amounts, and preserves exact totals and duplicate-save protections. Never invent percentage defaults or silently redistribute a missing role's share.
- Show the reserved Booking Asset in POS only when one is assigned; preserve resource scheduling and availability.

## Split Tip and Calendar actions — November 22 corrections
- Split Tip is the POS button and popup title. Open tickets have one shared editable tip total; a sole worker receives it automatically. Save Tip closes after confirmation. Additional-tip payment choices remain for closed tickets only.
- % Split divides the ticket tip equally per attending dog, then divides each dog’s portion by work role. Grooming and Full Wash have independent owner/manager-editable percentages under Settings → Tip Distribution; do not invent a Full Wash default. Manual amounts remain available.
- Ready for Pick-Up reminders may be dismissed without an outgoing contact (for example, when the customer called first). Dismissal affects all devices at that location but never records a fictitious call/text or cancels a message. The action menu floats above the notices.
- Calendar right-click includes Ready for Pick-Up to reopen snoozed reminders immediately. Copy/Cut/Paste applies to the whole family appointment, never just the clicked dog. Cut moves only when Paste succeeds; Copy uses a new visit, without payments, tips or completion state. Preserve scheduling validation and employee/business isolation.

- Calendar context menu label is Ready for Pickup. Customer Contacted records time and method separately from sending messages or making calls. Settings → Sales Tax exposes the existing business tax policy; open appointments recalculate automatically, preserving exemptions and closed history.

## Subdomain preparation — November 25, 2026
- Optional business-host routing stays disabled until the final domain, hosting hostname/TLS support and publication are explicitly approved. Preserve existing addresses through the allowlist when enabling; never infer a business from a display name or unknown subdomain. Hostnames select context, not employee authorization. Do not change DNS, hosting, sending origins or cross-domain sessions as part of code preparation.

## Five-site preparation — November 26, 2026
- Site roles are opt-in separate deployments; leave the current site role unset and routing off until activation is authorized. Sales has no business database; Administration reuses production controls without duplicate schedulers or schema bootstrap. Development and Staging require separate restricted databases and independent credentials. Never treat a subdomain alone as isolation. See docs/five-site-deployment.md.
- Personalized questionnaire-based Sales/Training videos remain future work; the public sales preparation must not imply those videos or paid signup are operational.
