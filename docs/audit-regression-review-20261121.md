# Audit regression review — November 21, 2026

Scope: check the current unpublished application for regressions in existing workflows after audit additions. No hosted records, provider messages, real payments, or GitHub publication were used.

## Confirmed findings

- Previously diagnosed POS dog-name failure: the published return-visit query included `VOIDED`, which is not a TicketStatus enum. The existing local correction removes that query value; voids retain their approved CANCELLED status plus void marker. The same helper also serves booking, item/timing changes and checkout. The local database reproduces the original error and confirms rollback, then confirms corrected package addition/removal/re-addition without deleting pet history.
- Reviewed service-catalog loading rejected an unchanged Windows checkout because CRLF line endings changed the file hash. Normalize CRLF to LF before checking the same reviewed hash. Altered service contents still fail before writes. This is a checkout-format defect; it is not evidence that an audit change altered the catalog itself.
- Settings search no longer matched the older phrase “first groom credit” after Refer-A-Friend wording changed. Restored `credit` as a search keyword without changing labels or referral rules.

## Verification

- Initial regression suite: 1,096 checks, 1,056 passed and 40 failed. Reviewed every failure. Outdated fixtures were missing newer imports, transaction/authorization context, session props, or current approved labels. One activation-time fixture was timing-dependent. Updated those fixtures without changing their underlying workflow assertions.
- All initially failing checks subsequently passed in focused reruns. Logs: `../audit-regression-20261121.log`, `../audit-regression-fixtures-20261121.log`, `../audit-regression-recheck-20261121.log`, `../audit-regression-final-recheck-20261121.log`. New catalog test covers both LF/CRLF and rejection of changed content. No successful full-suite rerun was necessary after the focused corrections.
- New `tests/database-enum-literals.test.cjs` passed. It checks literal enum values in database queries/writes against Prisma's model definitions, including calls through untyped helpers. Display labels are intentionally not treated as database enums. Computed query values are outside this static test.
- Static screen-to-route review: 210 fixed-address calls, then an expanded 289 calls including recognized dynamic URL patterns and literal HTTP methods, all had matching routes/methods. This does not prove every callback's runtime behavior.
- Isolated real MariaDB workflow (`scripts/test-pet-package-database.cjs`, `TEST_TICKET_LIFECYCLE=1`) passed dog-package retries, customer confirmation, check-in/undo, ready/undo, cash payment, zero-balance closing, retained grooming notes and combined report database loading. Log: `../audit-local-db/lifecycle-01.log`. Only authentication was supplied by a fixture; business/database operations were real. Database server stopped afterward.
- Targeted diff whitespace validation passed. The prior production build remains the latest full build; this review's two production changes are a catalog normalization expression and a search keyword, verified by focused tests.

## Boundaries

This review found no additional confirmed breakage in the checked workflows. It is not a claim that every screen/control has been manually exercised or that the deployed host is verified. Actual GoDaddy deployment/sign-in, connected email/SMS/OpenAI, payment providers, and physical-device offline behavior still require their respective environments. Existing deferred features remain deferred. Nothing published.

## Release verification — November 21, 2026

The complete production build passed (`../release-build-20261121.log`), including compilation, type checking and route generation. Existing CSS compatibility warnings remain non-blocking. Next-generated configuration was restored to its original bytes. The user authorized publishing all completed agreed changes, including the dog-name correction. The release includes `docs/GroomPro-testing-guide-20261121.txt`; actual GoDaddy deployment and provider/device testing remain explicitly unverified.
