# POS ticket layout brief

The user's references call the existing salon workflow DaySmart, the current implementation GroomPro, and the second visual reference Base44.

## First layout pass
- Existing and new tickets use a desktop workspace with a three-column header, item body, and three-column footer.
- Existing ticket header: ticket ID/status/created date/move appointment; check-in/ready/pickup completion timestamps; customer ID/name/dogs/account owed and credit/daycare state.
- Footer: general actions, totals/tax/tip, and payment/close. Keep these visible at normal desktop dimensions. Long item/history lists may scroll independently; small screens retain access through responsive scrolling rather than clipping controls.
- Preserve all existing handlers, payment methods, rebooking week shortcuts, assignments, rewards, account adjustments, notes, history, PIN behavior, navigation, and Calendar search.
- Closing via the status selector uses the same balance-checked checkout action as the checkout button.

## Requested additions to implement in subsequent POS work
- Make Recurring beside the scheduled appointment: every N days/weeks and ordinal weekday patterns such as the first Monday of each month, with a chosen ending date (months or year-end). Existing one-time rebooking remains available.
- Pet photos from customer intake forms, including multiple dogs on one ticket. The current Pet schema has no photo field.
- Ready-for-pickup text delivery. The current READY action records status and pickupAt only; do not describe it as sending a text.
- Body additions for package sales, VIP services and memberships. Preserve existing service/product sale controls during that expansion.
- Customer profile actions and daycare editing in the header. Current layout shows existing daycare state.
- The user's examples explain account balance/credit: initial deposit, unpaid no-show fee, and referral credits. Display the actual ledger values; do not invent or automatically apply credits from the examples.
- Detailed footer requirements are still forthcoming from the user.

