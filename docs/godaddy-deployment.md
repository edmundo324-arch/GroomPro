# GoDaddy database deployment

## Runtime settings

Deploy the repository root using Node 22, install with `npm ci`, build with
`npm run build`, and start with `npm start` (entry point: `scripts/godaddy-start.cjs`).
The server binds to `0.0.0.0` and the host-provided `PORT`.
GoDaddy preview logs previously showed `npm run dev`. That script now uses the
same bootstrap gate before running Next in development mode, so preview cannot
bypass database initialization. Local development also needs configured MySQL.
GoDaddy must run the build before the start command; a static-only deployment
cannot serve the GroomPro database APIs.

Configure the intended preview or published environment with either all of
`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` and optional `DB_PORT` (3306),
or one `DATABASE_URL`. A nonempty URL wins. In particular, remove the old
example placeholder URL if GoDaddy supplies the separate variables. Special
characters in credentials must be percent-encoded in a URL; split variables
are encoded automatically. Preserve provider-required TLS URL parameters.
Bootstrap and the APIs use the same Prisma connection and TLS settings.

No production credentials are needed during build. Secrets belong in the
hosting environment or an ignored local `.env.local`, never in GitHub source.
Preview and published deployments can have different database settings; check
both explicitly before concluding that the database visible in the console is
the one serving the app.

## Schema lifecycle

`npm run build` generates a complete SQL bundle and manifest from the Prisma
schema plus the supplemental raw-SQL tables. There are 47 application tables.
Historical migrations are partial and overlapping, so `prisma migrate deploy`
is not a valid way to initialize this repository from empty.

`npm start` waits for bootstrap and schema verification before starting Next.
A failure exits nonzero instead of serving an app with an empty/partial database.
Bootstrap uses a database-scoped advisory lock, creates missing tables and
columns, and checks required columns. Existing rows are retained. It never
runs `db push --accept-data-loss`, drops tables, or disables foreign keys.
DDL auto-commits in MySQL; metadata checks allow an interrupted run to resume.
Existing incompatible column definitions need an explicit reviewed migration;
bootstrap does not silently rewrite existing business data.

Run `npm run db:bootstrap` for a manual bootstrap and `npm run db:verify` for
read-only verification. Use the GoDaddy runtime for private database hosts
that cannot be reached from a workstation.

For a manual import into a confirmed empty database, download the
`godaddy-groompro-schema-production` artifact from a successful GitHub Actions run and
import `godaddy-groompro-schema.sql` in the hosting database console. Select
the intended database first. This SQL is a from-empty import, not a rerunnable
migration. Restart the application afterward; bootstrap verifies the result.
The build artifacts include the SQL and column manifest used by the runtime.

## Verification

1. Confirm runtime logs show `verified 47 application tables and all required columns`.
2. In the selected GoDaddy database, run `SELECT DATABASE();` and `SHOW TABLES;`.
3. Load `/api/health`. Expect HTTP 200, `database: connected`, `schema: ready`,
   and `tableCount: 47`. `setupRequired: true` means the schema exists but there
   is no business record yet; it does not mean bootstrap failed.
4. With an existing business/employee session, create a clearly named verification
   customer or product using GroomPro. Read it back through its API and independently
   select the same ID in the hosting database. This establishes actual API-to-GoDaddy
   read/write linkage; a successful CI test alone does not establish it.

Schema creation seeds only the global module catalog. It does not fabricate
customer data or reset employee PINs. `/setup` is an explicit **demo** seed workflow
that creates sample customers and schedules; use business initialization/import
for real production data.

## Automated checks

`npm test` covers environment precedence, credential encoding, invalid configuration,
and complete artifact contents. GitHub CI runs MySQL 8, the production build,
SQL import into a separate empty database, fresh/repeat/interrupted bootstrap,
data preservation, real production startup with split DB variables, employee
PIN sessions, API customer/product/schedule persistence and credit adjustments.
The same integration checks run in a second job against the preview/dev startup path.
`npm run test:integration` requires an empty disposable database ending in `_test`
via `TEST_DATABASE_URL`. It creates test data and an additional `_import_test`
database and must never be pointed at a production database.

Hosting contract reference: [GoDaddy Node.js Hosting upload requirements](https://www.godaddy.com/help/upload-my-ai-generated-app-to-godaddy-nodejs-hosting-42987).
