# Approved Calendar Assignments

Approved late finishes and off-day appointments stay in their assigned employee's Calendar column, including when Working Only is selected. Normal unavailable assignments still appear in Unassigned / Other. This changes placement only: staff hours, actual service employees, commissions, prices and appointment times are unchanged.

New exceptions are saved only after the existing scheduling-override permission check. They are tied to the dog, employee, shop, start and duration. The Calendar API verifies these before returning a display flag. Client-supplied approval fields are discarded by assignment validation. A different date, time, duration, employee or location does not inherit an old exception.

## Already Approved Sample Appointments

The November 21 sample correction was saved before approval metadata existed. `calendar-assignment-recovery.json` contains 165 SHA-256 fingerprints for those explicitly authorized placements, including their return bookings. Each fingerprint binds tenant, location, ticket, pet, employee, start and duration. The file contains no names, contact information, PINs or readable record IDs. Recovery is read-only and does not update database records or broadly exempt the original business from scheduling checks.

## Verification

- Approval, assignment-store and Calendar move tests: 11 passing.
- Actual Calendar component render: approved Tuesday and late-finish appointments appear in the employee columns with Working Only enabled; an unapproved appointment remains Unassigned. Browser visual check confirmed the rendered placement.
- Four focused existing per-dog Calendar regression tests passed (overlap lanes, legacy cards, multiple customers and dogs without lines).
- All 165 existing approved placements checked against the updated projection using read-only live appointment records; all matched, including December 31.
- TypeScript check passed.
- The broader existing pet-visibility test file also contains an unrelated Undo Check-in fixture which fails to mock `@/src/lib/request-location`; that failure was not changed or represented as passing.

GoDaddy must sync this release before its live Calendar uses the correction.
