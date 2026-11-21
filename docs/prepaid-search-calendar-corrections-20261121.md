# PrePaid discovery and calendar selection

## Approved changes

- Packages lists regular Packages and PrePaid offers together. All / Packages / PrePaid independent checkboxes precede Include Inactive. The + PrePaid Package action sits beside + Add Package.
- Opening the PrePaid manager shows Add PrePaid immediately with neutral input focus. Existing rows open for editing. Optional descriptions are validated and stored with offer settings, without changing purchased package terms.
- Shared typed record picker replaces dropdown-only item discovery in PrePaid setup/purchase/application, VIP selection, assigned pet packages, referral items, promotion items, vendor products, message templates/customer selection, gifted-package recipients, waitlist and portal service selection. Ordinary settings dropdowns retain their purpose. Existing typed catalog/POS/package searches now include descriptions and display them; inventory product responses include the existing description field.
- Quick filters also support any combination of POS services/packages/products and Messaging text/email. All is selected by default for Packages, POS items and Messaging, as subsequently requested by the owner.
- Commission choices explain the calculation base using the existing PREPAID / REGULAR values. No tax, commission rate, purchase eligibility or redemption rules changed. PrePaid visits still cover services/packages, not merchandise.
- The calendar receives the active saved ticket ID from the current POS window, including a newly saved draft. Day, Week and List highlight all cards for that ticket. Switching/closing changes the highlight, while normal hover highlighting remains intact. Whiteboard is unchanged.

## Verification

- 51 focused checks were run across catalog, prepaid purchases/transfers/gifting, pet items, portal access, messages and calendar behavior. One new highlight-test fixture omitted ticket status; after supplying that required fixture value, all three new discovery/highlight checks passed. The other 50 original checks passed.
- Isolated browser checks exercise real CatalogWorkspace / PrepaidOffers / SearchableSelect controls with fictional API responses: multi-type filters, description-only lookup, neutral opening focus, active Add PrePaid form, cents/description save payload and reopening, keyboard selection/Escape, disabled choices and multiselection. Desktop and 390px screenshots reviewed; no horizontal overflow in the narrow fixture. This is not a hosted database verification.
- Shared form window/providers and unrelated settings are stubbed in the isolated browser fixture. Existing full-application layout remains separate from those functional checks.
- Full TypeScript checking passed (including the final shared picker, form and calendar changes). Publication of this completed batch was explicitly requested by the owner on November 21, 2026. Hosted GoDaddy verification remains to be performed after syncing.
