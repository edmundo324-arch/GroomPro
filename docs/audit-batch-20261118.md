# First approved capability-audit batch

## Included

- Portable tenant export includes TIME_CLOCK, TICKET_TIPS, CUSTOMER_PORTAL_POLICY, EMPLOYEE_AVAILABLE_ONLINE, PORTAL_CANCELLATION and PORTAL_CHANGE records. Existing credential exclusions remain. This is portable data, not a full database/media backup or an automatic restore tool.
- Staff-composed Messaging email uses the existing tenant Resend configuration. No old draft is automatically sent. Provider acceptance is not described as delivery.
- Signed SMS opt-out/opt-in callbacks synchronize local contact preferences and are deduplicated and audited.
- Reports → Export CSV includes the displayed snapshot, prior-period comparison, scope and offline date. Spreadsheet formula-like names are escaped.
- Reports → Reconciliation is separate from all existing report calculations, as explicitly approved. It separates account-ledger settlements linked to period payments, and separates Customer Account Balance lines from closed-ticket line totals. Payment-date and closing-date figures are not equated. Unlinked historical settlements cannot be inferred.
- POS Ticket → three-dot menu → Print / save invoice or receipt opens a printable copy of saved lines, totals and recorded payments. The browser can print or save PDF. It does not send email, record a payment, save draft edits or close a ticket. Internal notes and payment tokens are omitted.
- A fresh/expired session can reach the Platform Owner / Developer PIN directly even without tenant device approval. Explicit platform entry filters out tenant staff PINs, including when digits overlap. Tenant staff still need an owner-verified device. No device approval is granted by platform sign-in.

## Verification and limits

Production build passed. Focused tests cover export retention/redaction, provider email outcomes, SMS preference parsing/signed-route handling, report CSV/reconciliation, receipt amounts/escaping and platform PIN entry/device isolation. Isolated browser verification used fictional records and mocked APIs: fresh platform PIN entry and sign-in succeeded, Reports rendered reconciliation and CSV control, and POS exposed the invoice/receipt action. The browser's new receipt popup was not exposed to the automation tab inventory; receipt content is separately renderer-tested.

The older pin-authority suite still has five failures also recorded in the pre-change baseline (an outdated PIN-length expectation and stale test dependency mocks). These tests were not rewritten to hide failures. Real GoDaddy sign-in, provider delivery, database-backed reconciliation and physical printing remain unverified. No live messages or payments were sent during development.

## Remaining audit work

This batch does not complete all 166 missing/partial audit entries. Automated workflows/reminders, complete receipt email delivery, complete recovery/restore, advanced reports, stock movement, multi-pet online booking and other audit extensions remain pending. Payment-provider selection, shop .bak/live 123Pet testing, Google integration and Whiteboard layout remain deferred. Business-rule decisions must be resolved individually before affected implementation.
