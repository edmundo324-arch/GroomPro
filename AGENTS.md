# GroomPro product requirements

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
