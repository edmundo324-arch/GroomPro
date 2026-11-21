# Audit reconciliation — November 19, 2026

Original 166 Missing/Partial entries: **73 resolved within approved scope; 93 remain open**. This is a count of audit entries, not 93 separate features. Several entries share one implementation (notably the custom-rule builder and Productivity Report).

| Open category | Entries |
|---|---:|
| Development / decision | 7 |
| Custom-rule decisions | 30 |
| Provider / payment dependency | 19 |
| Deferred Maps / mobile | 21 |
| Deferred shop imports | 2 |
| Not authorized: Training | 2 |
| Verification / host setup | 12 |

Published code: b13a17b. Local account-change reporting is also considered. “Resolved” means the original gap is addressed under the latest approved scope; it does not certify live hosting/providers. Open items include deferred and unauthorized work, missing business decisions, integration dependencies and verification. Specific automatic messages remain implemented even where the broader custom-rule audit entry is open.

| ID | Capability | Current status | Remaining gap / scope |
|---|---|---|---|
| 2 | Sales by service, product, membership, package, employee, and location | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 3 | Sales tax collected and tax liability reports | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 4 | Gross sales, net sales, refunds, voids, discounts, and adjustments | Development / decision | Saved prices, discounts, refunds and account changes exist; complete void/reversal reconciliation is still incomplete. |
| 5 | Payment method and payment processing reconciliation | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 6 | Outstanding balances and accounts receivable | Resolved in approved scope | Current balances and unpaid tickets implemented. User replaced overdue-aging assumption with collection on the next booked visit. |
| 7 | Employee productivity and revenue per employee | Development / decision | Productivity formula approved in principle; item-duration calculation not implemented. Returned/refunded exclusion still needs clarification. |
| 8 | Employee commissions, payroll-related reports, and tips | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 9 | Appointment volume by day, time, employee, service, and status | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 10 | Cancellation and no-show analysis | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 11 | Customer retention, repeat visits, and inactive customers | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 12 | Customer lifetime value and highest-value customers | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 13 | Membership revenue, enrollment, cancellations, and retention | Development / decision | Current enrollment and recorded payment reports exist; historical membership retention/status transitions remain incomplete. |
| 14 | Package sales, usage, and outstanding balances | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 15 | Gift card sales, redemption, and liabilities | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 16 | Inventory, product sales, and cost of goods | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 18 | Graphical dashboards and visual reporting | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 19 | Report filtering, exporting, printing, and scheduled delivery | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 20 | Multi-location reporting, where applicable | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 21 | GroomPro-hosted booking pages branded for each grooming business | Verification / host setup | Logo/theme/welcome implemented; custom-domain/host operation not verified. |
| 23 | Embeddable website booking widgets | Verification / host setup | Embed/link support implemented; external-site hosting behavior not live-verified. |
| 24 | Customer portal for existing and new customers | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 28 | Tenant-controlled appointment availability and booking rules | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 29 | Employee availability and service assignment | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 31 | Multi-pet and household booking | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 34 | Current rabies vaccination requirements and other required documents | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 36 | Deposits and authorized cards on file | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 37 | Cancellation, rescheduling, and no-show policies | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 38 | Booking lead-time and advance-booking restrictions | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 39 | Customer waitlists and available-slot notifications | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 40 | Booking abandonment tracking and recovery | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 41 | Booking conversion and customer acquisition reporting | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 42 | Prevention of conflicting appointments | Verification / host setup | Locked availability checks exist; real database concurrent staff/portal booking verification remains outstanding. |
| 43 | Recognize when a customer begins but does not complete an online booking | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 44 | Identify the point where the booking was abandoned | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 45 | Preserve available customer, pet, service, and appointment information appropriately | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 46 | Notify authorized staff of abandoned bookings | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 47 | Support automated or manually initiated follow-ups | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 48 | Track recovered appointments and associated revenue | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 49 | Respect customer communication consent and privacy requirements | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 50 | Appointment created | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 51 | Appointment confirmed | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 53 | Appointment rescheduled or canceled | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 54 | Customer checked in | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 55 | Pet ready for pickup | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 56 | Appointment completed | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 57 | Customer did not arrive | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 58 | Customer started but abandoned online booking | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 59 | Customer has not returned within a configured period | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 60 | Pet becomes eligible for rebooking | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 61 | Membership enrollment or cancellation | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 62 | Membership payment successfully processed or failed | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 63 | Package approaching expiration | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 64 | Package balance approaching zero | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 65 | Customer birthday or pet birthday | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 66 | Required documents approaching expiration | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 67 | Outstanding invoice or unpaid balance | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 68 | Employee or manager follow-up required | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 69 | Customer confirmed or has not confirmed | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 70 | Customer responded or did not respond | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 71 | Appointment remains active | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 72 | Customer is an active VIP member | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 73 | Payment completed or failed | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 74 | Pet is eligible for a particular service or program | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 75 | Customer has an upcoming appointment | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 76 | Follow-up has already been completed | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 77 | Employee has manually intervened | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 78 | Immediate actions | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 82 | Time-zone awareness | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 83 | Cancellation of obsolete scheduled actions | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 84 | Prevention of duplicate or contradictory communications | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 85 | SMS notifications | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 86 | Email notifications | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 87 | Internal staff notifications | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 88 | Tasks and follow-up assignments | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 89 | Customer account updates | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 90 | Appointment status updates where appropriate | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 91 | Automated rebooking invitations | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 92 | Membership-related follow-ups | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 93 | Payment reminders | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 94 | Customer retention messages | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 98 | Role-based permissions | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 99 | Automation history and delivery logs | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 100 | Failure handling and retry behavior | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 101 | Message personalization using actual customer and pet information | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 104 | Reporting on automation effectiveness | Custom-rule decisions | Specific approved automatic messages/tasks may exist; the general configurable event/condition/action builder is not implemented. User requested options and has not selected scope. |
| 107 | Appointment confirmations | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 108 | Multiple reminder schedules | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 109 | SMS and email reminders | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 110 | Two-way messaging | Verification / host setup | Two-way SMS/email handlers exist; live inbound provider configuration/delivery not verified. |
| 111 | Customized message templates | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 112 | Customer and pet information placeholders | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 113 | Automated appointment status notifications | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 114 | Ready-for-pickup notifications | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 115 | Appointment changes and cancellation notifications | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 116 | Rebooking reminders | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 118 | Message delivery status | Verification / host setup | Delivery callbacks/logs exist; live provider delivery remains unverified. |
| 119 | Confirmation tracking | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 120 | Manager follow-up notifications | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 121 | Customer opt-in and opt-out management | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 124 | Membership and package purchases | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 125 | Integrated credit and debit card processing | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 126 | Contactless and mobile payment options | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 127 | Secure card-on-file payments | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 128 | Digital invoices and receipts | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 129 | Payment links | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 130 | Deposits and prepaid balances | Development / decision | Prepaid package balances/refunds exist; explicit reservation-deposit application/refund workflow remains incomplete. |
| 132 | Discounts, promotions, and credits | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 134 | Refunds, voids, and adjustments | Development / decision | Native cash/account-credit refunds exist; complete void/payment-reversal lifecycle remains incomplete; provider reversals deferred. |
| 135 | Outstanding invoices | Resolved in approved scope | Outstanding tickets/account balances implemented using approved next-appointment collection policy, not invented aging buckets. |
| 136 | Recurring membership billing | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 137 | Failed-payment handling | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 138 | Gift cards and stored-value liabilities | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 139 | Payment transaction reporting | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 141 | Financial reconciliation | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 146 | Breed, size, coat, and behavior information | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 148 | Photos and before-and-after comparisons | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 149 | Customer-facing grooming report cards | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 151 | Grooming progress tracking | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 152 | Vaccination and document tracking | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 153 | Customer retention information | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 154 | Customer tags and segmentation | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 155 | Membership and package history | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 157 | Customer data import and export | Deferred shop imports | Import/export code exists; representative shop .bak/live 123Pet validation remains deferred. |
| 162 | Employee performance reports | Development / decision | Time, assigned sales, commissions and tips exist; new Productivity Report remains unfinished (same implementation as item 7). |
| 163 | Service duration tracking | Resolved in approved scope | Per-stage elapsed-time reporting exists. Separate employee work timers were explicitly rejected; planned item-duration productivity is tracked under 7/162. |
| 164 | Commission and tip reporting | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 165 | Internal task management | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 166 | Grooming workflow tracking | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 167 | Employee training and quizzes | Not authorized: Training | Training/Sales Studio work is explicitly unauthorized; general audit approval does not override that restriction. |
| 168 | Coaching and performance feedback | Not authorized: Training | Training/Sales Studio work is explicitly unauthorized; general audit approval does not override that restriction. |
| 169 | Manager notifications | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 170 | Multi-location staffing, where applicable | Verification / host setup | Shift shop assignments and cross-shop availability implemented; real concurrency/load verification outstanding. |
| 171 | Map-based appointment calendar | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 172 | Route optimization by travel time and distance | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 176 | Travel-time buffers between appointments | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 179 | Recurring neighborhood routes | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 180 | Multi-vehicle scheduling | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 181 | Vehicle and employee assignments | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 182 | Automatic route suggestions | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 183 | Cancellations and route recalculation | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 184 | Nearby customers eligible for last-minute openings | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 185 | Emergency rescheduling when vehicles become unavailable | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 187 | Daily route overview | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 189 | On-my-way notifications | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 191 | Customer communication while traveling | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 193 | On-site payment collection | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 194 | Mobile invoices and receipts | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 195 | Offline access to essential information | Development / decision | Offline edits and saved reports exist; fresh reports do not recompute unsynced work and uncached records remain unavailable. |
| 196 | Vehicle-related notes and maintenance tracking | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 197 | Revenue per route | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 198 | Revenue per vehicle | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 199 | Revenue per employee | Resolved in approved scope | Current code and chronological test/review evidence address the original gap within the user-approved scope. Not a claim of live production validation. |
| 200 | Mileage and travel time | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 201 | Grooming time versus driving time | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 202 | Estimated operating costs | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 203 | Appointment profitability | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 204 | Route profitability | Deferred Maps / mobile | Deferred with Maps/routing and vehicle operations; not counted as completed. |
| 206 | Responsive phone and tablet interfaces | Verification / host setup | Responsive shared controls and focused previews exist; complete all-module/device verification remains outstanding. |
| 209 | Optional feature modules | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
| 212 | Clear, human-friendly field descriptions and hints | Verification / host setup | Shared hint framework and wording work exist; universal content and placement verification remains incomplete. |
| 213 | Simple onboarding | Verification / host setup | Onboarding/device/tenant setup exists; full first-use live hosting/provider path remains unverified. |
| 214 | Customer and pet data migration | Deferred shop imports | Import/export code exists; representative shop .bak/live 123Pet validation remains deferred. |
| 215 | System reliability | Verification / host setup | Production builds and focused tests pass; live hosting/database/provider reliability not established. |
| 216 | Data backup and recovery | Verification / host setup | Export coverage improved; full host disaster recovery, backup retention and restore are unverified. |
| 218 | Multi-location scalability | Verification / host setup | Sharing and shop comparisons implemented; large multi-location concurrency/load verification outstanding. |
| 219 | Transparent subscription and integration costs | Provider / payment dependency | Native portions may exist; full capability depends on deferred payment/provider integration or verified provider/hosting costs. |
