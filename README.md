# GroomPro Suite

GroomPro Suite is a multi-tenant grooming salon management platform designed for fast shared-device front-desk and salon workflows.

## Locked foundation rules

- Multi-tenant from day one: every business has isolated customers, pets, tickets, employees, communications, and operational data.
- One business can have multiple locations.
- Employees have individual 4–10 digit PINs for fast action-based identification.
- Shared computers, tablets, and phones remain inside GroomPro; switching employees does not log out of the application.
- PIN entry is action-based, not screen-based. Searching/viewing customers does not require a PIN; tracked changes do.
- The employee's name is shown in audit history, never the PIN.
- Ticket and Appointment are the same core module/record.
- Every important record has a contextual View Ledger. The ledger is opened from the item being investigated.
- Customer-related changes are associated with the customer so customer, pet, and vaccination history remains together.
- Ticket ledgers include creation, changes, communications, payments/payment type, reminders, closure, and other tracked actions.
- SMS ledger entries link directly to the customer's two-way messaging conversation.
- Customers can confirm appointments by replying YES, CONFIRM, or C.
- Duplicate-customer prevention occurs before creating a new customer; matching phone/customer information is surfaced and the existing record is opened.
- Calendar is the primary workspace.
- Floating working windows are preferred so the calendar remains visible and the user can arrange windows with minimal navigation.
- When an appointment date changes in a ticket, the background calendar follows the selected date.
- Zero-duration appointments are hidden from the calendar.
- Client imports use a human-readable field dictionary and manual mapping for unfamiliar source headers such as Ab2 or ID311.
- Customer addresses are first-class data fields rather than being hidden in notes.
- Imported customers are matched by phone/email before a new customer record is created.
- CI verification checkpoint: Prisma schema normalization is complete before application build verification.

## Development

The application is being built in phases with development, preview/test, and production environments. Desktop, tablet, mobile, and 70-inch touch-display workflows are first-class targets.

## Hosting target

GoDaddy Node.js Hosting is the intended production hosting environment, with GoDaddy-managed MySQL as the initial database target.
