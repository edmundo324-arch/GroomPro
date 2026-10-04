# Employee compensation

Manage compensation inside the shared employee editor. Leaving employee rules disabled retains legacy service percentages. Service exemptions always override the employee's earnings. Percentage rules use the discounted line amount; flat per-dog rules count a dog once per matching rule on the ticket. Package percentages apply to the allocated component prices so the package is not commissioned multiple times at its full price.

Qualification uses the last 30 calendar dates, inclusive of today, in the employee's location timezone. Completed grooming assignments count distinct dogs per worked date. Their service/check-in date establishes a worked date. Managers record any other actual worked dates, including days with zero dogs. A scheduled shift alone is not evidence that the employee worked. Hire date controls minimum-tenure thresholds; an unknown hire date cannot qualify a tenure requirement.

Rates change automatically by default. If the tenant enables manager approval, the last approved rate (or base rate before the first approval) remains in use until a manager approves the new qualified rate. Closing a paid ticket freezes its line earnings. Later rule edits do not rewrite closed tickets.

Hourly rates and tip participation are compensation configuration; this change does not create a time-clock/payroll payment processor. No paychecks or transfers are initiated.

VIP first-recurring-payment rules use service categories from the enrolled plan. The activation line identifies the selling employee and can be reassigned in POS. `recordFirstBillingCommission` is the idempotent payment-confirmation hook: it accepts only a recorded PAID/SUCCEEDED recurring payment with a processing timestamp, excludes the $1 activation, locks the membership, and stores one earning per membership. The existing application has no recurring payment processor; its future tenant-specific processor must call this hook inside the verified payment transaction. Pending scheduled payments never count as earnings. No actual membership charge was initiated during development.
