# Import and migration workflow

Settings → Data import and migration is the shared importer. The old direct CSV endpoint is retired because it discarded unmapped fields.

## Source formats

Download Google Sheets as XLSX (all worksheets) or CSV (one worksheet). Select related files together. CSV, TSV/tab-delimited TXT, XLSX, XLS, JSON record arrays, XML record collections, supported ZIP bundles, and SQLite tables use one dataset model. SQL support is deliberately limited to explicit-column, literal-value INSERT exports; uploaded SQL is never executed. PostgreSQL, MySQL/MariaDB, SQL Server and applications with export APIs can supply these intermediate formats. Native backups and direct database/API connections are not implemented and must not be advertised as connected.

Images, PDFs and DOCX files may be retained as encrypted historical attachments, individually or in ZIP bundles. A related manifest can preserve source customer and pet identifiers; retaining a file does not automatically turn it into a profile photo. Unsupported archive entries, duplicate headings, malformed rows, binary SQLite columns, unsafe XML entities and unsupported SQL statements fail visibly. Nothing is silently skipped. Files are limited to 40 MB, expanded Excel workbooks to 128 MB, and selected migrations to 50,000 rows.

## Security and staging

Configure `GROOMPRO_IMPORT_KEY` with 32 cryptographically random bytes encoded as 64 hex characters. Back it up separately from the database. The key never goes to the browser. Original datasets, protected source values, and recovery snapshots are compressed and encrypted with AES-256-GCM, with the tenant ID authenticated as additional data. A different tenant cannot decrypt the ciphertext. Do not rotate or remove the key without re-encrypting existing imports.

Only administrators and managers can stage, review, execute, retrieve source records or roll back imports. PIN/session policy applies. Reports mask recognized protected fields and never activate imported merchant credentials. Imported employees start inactive with no usable PIN. Assign a PIN through the shared employee editor after reviewing their role.

## Mapping and review

Every exact source heading receives an operational, historical, protected or unresolved disposition. Unknown headings default to explicit historical retention; users can change the mapping. There is no exclusion option. Original field names, values, blanks, worksheet names and Excel cell metadata remain in the encrypted dataset. Inspect source records through the review screen; protected values remain masked.

Stable source IDs and a persistent source namespace prevent unintended duplicates. Link a reviewed existing record by its GroomPro ID when there is no existing stable source link. Contact and name similarities are not automatic merge authority. Ambiguous contacts, duplicate IDs, cross-tenant targets and unresolved owners block execution.

Date-only ISO values are supported directly. Month/day/year exports require selecting that format. Timestamps additionally require the source timezone. Original formatted values remain preserved. Insignificant trailing decimal zeros are removed for numeric conversion; nonzero precision beyond the target is rejected rather than rounded. Weight ranges remain weight descriptions, not guessed exact pounds. The supplied NoShow field is Boolean, so it is retained historically rather than misrepresented as a count.

## Commit, recovery and reconciliation

Preview is separate from execution. Validation produces a field inventory, row actions, before/after changes, relationship errors and financial-review fields. Execution locks the tenant, recomputes the plan, checks its fingerprint and commits operational changes, source mappings, recovery snapshots and the report in one transaction. Changed data requires revalidation. A failed transaction leaves operational records unchanged and can be retried; a completed job is idempotent. Import history reopens staged jobs and their reports.

Source balances, historical discounts, loyalty values and prepaid quantities remain retained for explicit reconciliation. Importing them does not invent payments or silently reset current balances. No current recurring-billing or merchant credential is activated from a source record.

Rollback restores unchanged updated records and removes unused records created by the import in a transaction. It refuses edited records or subsequent operational activity. It preserves the encrypted source job and reports. If subsequent activity exists, use a separately reviewed corrective migration; do not force deletion.

## Schema deployment

The normal GoDaddy bootstrap adds missing schema columns and the ImportJob/ImportChange tables. The versioned `20261011_import_foundation_v1` migration widens customer and pet notes to LONGTEXT, checks its checksum and is safe to rerun. Existing values are not shortened. Schema rollback uses the previous application with additive columns retained; dropping populated columns is not a safe rollback procedure. Database backups remain necessary before production deployment.

## Verification boundaries

Automated tests exercise real isolated MariaDB transactions, long notes, ownership, tenant isolation, exact original retrieval, reimports, reviewed updates, rollback and injected failure/retry. The supplied exports must also pass field-level reconciliation before a production migration is called complete. The private source validation report is generated outside the repository, and source records are never committed to GitHub.
