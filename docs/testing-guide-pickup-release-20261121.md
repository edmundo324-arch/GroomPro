# Testing Guide, Tester Businesses, PIN and Pickup Notices — November 21, 2026

## Where to Start

**Blue Menu → Testing Guide** opens a movable, resizable guide beside the working screen. It includes the earlier shop-work checks plus the subsequent PrePaid, search/filter, multiple-dog highlighting, messaging/template, employee PIN, calling and Pickup Notices changes. Screenshots can be enlarged inside the guide. Results and notes save separately for each business; platform Owner/Developer access can review feedback from all businesses.

**Settings → Access & subscription → Subscription → GroomPro platform access controls → Create business** offers **Start With Sample Records From**. The copy creates new record identifiers and retains customer/pet/ticket relationships, operational history, catalog and exported business settings. It copies into a new business only, in the creation transaction. Set new employee PINs; use the newly entered owner PIN. Platform Owner/Developer access remains through Open Business.

The sample-copy option can link the new business to GroomPro's existing SMS/email connection without duplicating provider secrets. A dedicated connection takes priority when configured for that business. Automatic-message preferences are preserved. Use different test customer phone numbers in the two businesses: ambiguous replies to a shared sending number are not assigned to an arbitrary business. Opt-out replies apply to matching contacts using that shared number. Provider setup and live delivery must still be tested on the host.

## Pickup and PIN Corrections

- Reorder Menu opens Employee PIN when needed and retains the requested order through sign-in.
- Employee PIN saves work inside the existing transaction, without attempting an unsupported nested transaction.
- Pickup Notices uses the shared floating-window controls, pinned header, dated Ready timestamp, names that open POS, and visible Undo/Send Text actions.
- Right-click and ⋯ expose Open Appointment, Send Text, Call Customer, Cancel Queued Text and Undo Completion.
- X snoozes notices for the tenant-configured interval (factory five minutes). A new completion brings notices back; other devices refresh on the existing polling interval.
- Call Customer offers the device's dialer and a separate Record Call Already Made action.
- Cancel Queued Text preserves Ready status. The sender checks the completion and cancellation under the same ticket lock before claiming a provider request. An already-claimed message cannot be recalled.

## Verification and Limits

Focused automated checks cover PIN/session behavior, scoped transactions, pickup cancellation and calling, message-provider sharing, callback signature boundaries, feedback isolation/version conflicts, and copied-record relationships. Browser checks use the actual guide/window components with fictional records and verify movement, scrolling, screenshots, saving, reopening, cross-business owner feedback and access to the underlying workspace.

No live business was copied and no real texts/emails were sent by these checks. Local fixtures do not prove GoDaddy's database configuration or provider delivery. The two businesses are created by the owner after deployment. Copies do not include active sessions, PIN credentials, stored card tokens, import staging/recovery internals or provider credentials. External image/document links remain links. Payment processing and the real 123Pet backup remain tabled.
