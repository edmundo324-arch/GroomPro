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
