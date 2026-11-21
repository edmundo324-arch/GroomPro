# Messaging and POS Pickup Updates — November 21, 2026

## Included

- Messaging → Message Templates: create/edit templates, discover the editor from blue-menu Search, and insert customer, dog, appointment, business and shop details. Selecting a customer shows their dogs.
- Three reminder texts and three reminder emails become available automatically. Existing tenant templates remain intact; saved deletions of factory templates are respected.
- POS → Items: employee choices filter while typing; item search opens a readable window for services, add-ons, packages and products, with descriptions. POS Status also filters while typing.
- POS header: Arrived/order appears before check-in time; Completed marks Ready for Pickup, Called records the call, and Texted opens an editable pickup message by default.
- Automatic pickup messages wait five minutes by default. Tenants can change the delay and Texted icon behavior. Leaving Ready cancels the pending event; Undo restores the recorded prior status.
- Approved devices can show pickup notices while employees are signed out. Undo still requires employee access. Device notice settings include opt-out and shop assignment for multi-location businesses.

## Verification

Production build and TypeScript checks passed. Focused tests cover message defaults and expansion, tenant/device access, pickup timing, custom-message timing, stale completion protection, Undo, manual text records and duplicate prevention. Browser fixtures checked template editing/insertion, customer dog names, POS item searching and edited pickup-text submission.

Tests used fictional records and mocked providers. No real customer texts or emails were sent. Live GoDaddy/provider delivery is not verified by these tests. Device notices require GroomPro to be open; multi-location devices need an assigned shop. Actual automatic sending still requires the existing configured message service and server runner.
