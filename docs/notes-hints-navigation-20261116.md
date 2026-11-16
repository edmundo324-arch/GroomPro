# Notes, hints and navigation — November 16, 2026

## Behavior
- Blue header context menu provides Reorder tabs and Search. Order is saved per business/user. Required tabs retain visibility; overflow stays on one row. Search retains its term until cleared, offers multiple destinations, and can open the current customer’s Account field with a highlight.
- Shared floating hints use canonical field names and destinations. Business defaults enable hints; Settings → Calendar & Workflow → Helpful hints can turn them off. Whiteboard is excluded. PIN remains an authorization prompt with initial focus.
- Agreement Settings opens its form immediately, requests PIN through the authorization module, resumes after sign-in, and supports close/resize/maximize. Shared editor paper styling and window preferences remain in place. Workflow and operating-hours hydration preserves edits with conflict choices.
- POS Customer Notes displays the shared customer and pet standing notes. The pet-name popup continues to show Today’s Grooming Notes. Earlier free-text instructions stays visible with import guidance.
- Separate customer popup-note input is removed. Both stored texts are combined for display. Saving the combined customer notes consolidates them transactionally with concurrency checks and an audit entry retaining original values.
- Settings → Calendar & Workflow → Appointment Appearance shows Service type before Status and the before/after previews above the copy-source controls. Color and status logic is unchanged.
- Dated imported GroomComments appear in Grooming history with original text. Recognized Body/TBF/Ears/Tail labels populate their fields; unlabeled dated text becomes Special notes. Undated text stays in Earlier free-text instructions. No synthetic tickets or name-based ownership guesses are created.

## Import boundaries
The parser recognizes US month/day/year and ISO year-month-day date headings with four-digit years. Unrecognized dates and formats are retained verbatim rather than assigned an invented date. Ticket association requires a single matching pet/date within the same customer and business. History is projected from preserved imported comments, so an import rollback does not leave orphan history rows. No database schema changes are required.

## Verification
Focused import/defaults/history, PIN-retry, navigation and window-geometry tests pass. Sample-screen browser checks covered desktop, tablet and phone sizes: PIN/resume, resize, floating help, menu ordering, retained search, Account highlighting and Customer Notes. These used fictional records and simulated responses. Production compilation/type checking passed.

The local database was unavailable. Live 123Pet imports, database persistence and GoDaddy operation still require validation after deployment. Search includes indexed customer fields and Settings plus labeled fields in mounted modules; it is not an exhaustive index of unopened record editors. Permission-dependent administration sections still wait for verified permissions. No claim of an exhaustive all-module runtime audit is made.
