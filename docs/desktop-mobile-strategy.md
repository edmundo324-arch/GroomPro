# GroomPro Desktop and Mobile Groomer

Desktop remains the comprehensive management application and current development priority. Mobile Groomer will be a separate presentation of operational tasks, not a separate business-data system. No full mobile redesign is part of this change.

## Existing foundation and boundaries

`app/api` provides server endpoints; `src/lib` contains shared rules and services. Desktop components in `src/components` already consume these endpoints and shared authorization helpers. The 123Pet connector belongs in the integration service layer and Windows connector, not in a desktop-only React component. A phone must not need to execute SQL or reproduce connector validation.

Not every existing rule is fully extracted from UI components. When adding a mobile workflow, reuse the relevant server operation and extract any remaining shared rule with regression coverage; do not copy the desktop component's mutation logic into a second implementation.

Future mobile navigation and screen composition may differ. Both clients must use the same tenant/location-scoped records, server authorization, operating-hours and availability rules, appointment editing, notes locks, payment safeguards, and idempotent mutations. Screen size never grants permission or changes a rule.

## Current UI policy

Preserve desktop dimensions and the approved Whiteboard. Use min-width:0, bounded controls, wrapping and deliberate local scrolling in shared components. Keep keyboard/focus support and avoid hover-only essential actions. Do not shrink dense desktop tables until their contents are unreadable. Dedicated mobile task screens are preferable for dense administration; their design is deferred.

The connector settings gain only narrow-screen wrapping and bounded inputs. No navigation, data model, payment flow or existing desktop screen is replaced.

## Review before future mobile architecture changes

1. Identify the desktop operation and shared server API.
2. Identify remaining UI-owned rules and their tests before extraction.
3. State any desktop behavior, performance, accessibility or state-retention tradeoff before implementing it.
4. Check desktop at its normal width and the changed component at phone/tablet widths. Confirm authorization and data isolation remain server-enforced.
5. Keep layout state separate from business state; avoid duplicate polling and caches when multiple presentations are active.
