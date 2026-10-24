# GroomPro test-data transfer

This ZIP contains the same JSON transfer file prepared for Settings > Data import and migration > Choose Related Files.

Contents: 203 customers, 488 pets, 454 future appointments, and 173 closed tickets, with booked package/service lines, historical payments, grooming notes, and employee assignments. Customer and pet records are fictional test fixtures. Employee references use the supplied staff names.

Syncing this repository does NOT import or modify database records. The ZIP can be selected directly in Choose Related Files; extraction is not required. The existing importer requires a configured GROOMPRO_IMPORT_KEY. No encryption key, credentials, or employee PIN records are included here.

Use source name `GroomPro Local Demo 2026`. Existing employee references must match uniquely. Employee profiles and service/package catalogs are not created. Review validation before executing. Existing matched tickets are not overwritten in add-new mode.
