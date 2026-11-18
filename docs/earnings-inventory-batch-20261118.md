# Employee reporting, checkout stock, and single-location workflows

## Completed
- Reports now include employee recorded hours, break hours, time excluding breaks, open shifts, saved commissions and assigned tips. The CSV includes these figures and previous-period comparison. Tips added later are attributed to the original ticket closing date, as approved.
- Employees see their own new time/earnings section; authorized managers see the permitted team, including inactive staff with recorded work. Existing report calculations are unchanged. Attendance uses the shift location and report snapshot, without inferring wages, overtime or paid-break rules.
- Closing a paid ticket subtracts linked merchandise quantities in the same transaction. Ticket/product locks prevent duplicate deductions from concurrent closes. Short stock permits checkout, floors the existing nonnegative count at zero, and records sold quantity and shortage in the audit ledger. POS shows a dismissible warning after successful closing. Unlinked merchandise warns instead of guessing a product.
- Single-location shops automatically use their location without routine location pickers in Reports, Time clock, import destination, agreement links, portal links, new booking assets and location settings. Employee creation defaults to the sole location while preserving the existing outside-marketing/unassigned option. Multi-location choices and administrative sharing controls remain available.

## Verification and limits
- 10 focused employee/report/CSV tests passed; 5 inventory and checkout tests passed, including concurrent/repeated close behavior with mocked transactions.
- Type check and production build passed. Local browser review with fictional API responses confirmed readable employee reports, a location picker with two locations, and no picker with one location while reports still load.
- No live database changes, provider requests, or GoDaddy deployment were performed. Live MySQL concurrency and real stock deduction on GoDaddy remain deployment checks. Inventory warning rendering was compiled but not exercised in the browser.
- Existing tenant-wide product stock scope is preserved. Previously closed tickets are not retrospectively deducted. Refund/restock workflows and other deferred audit items are not introduced by this batch.
