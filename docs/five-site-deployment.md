# GroomPro’s Five Areas — Preparation and Activation

The code supports five separately deployed areas. No deployment role is enabled by default. Leaving `GROOMPRO_SITE_ROLE` unset preserves the current site, addresses, background messages and database. No domain, hosting account or database was changed by this preparation.

| Area | Role | Prepared behavior |
| --- | --- | --- |
| Public Sales | `sales` | Public features page, plans section and configured sign-in/access/help links. No business APIs, database connection, background sending or payment collection. |
| Development | `development` | Existing GroomPro application behind Platform Owner/Developer access; separate database required. Visible development banner. |
| Master Administration | `admin` | Platform sign-in, existing subscription-plan editor, business creation/access controls, features and permissions. Authorized support can open the existing business workspace. No duplicate business-management implementation. |
| Tenant Application | `tenant` | Existing grooming software and permissions, optional exact business-subdomain mappings. The current deployment can remain in its default role during migration. |
| Staging | `staging` | Existing GroomPro application behind employee sign-in, separate staging database, visible testing banner. |

## Separate Deployments, Not Merely Different Addresses

Create independently configured apps from the same reviewed source commit. Sales needs no database. Administration deliberately uses the production database to manage real businesses, but does not run schema bootstrap or background message/report schedulers. Only the tenant deployment runs production schedulers.

Development and staging must have distinct databases, database users restricted to their own database, secrets, PINs, sessions and backups. Their database names must end in `_development` and `_staging` respectively. Set `GROOMPRO_LIVE_DATABASE_NAME` to the production database name; startup refuses matching or incorrectly named databases. This is a configuration safeguard, not a substitute for database grants: hosting must enforce those grants and prevent aliases to live data.

Use fictional seed data and newly provisioned test accounts. Do not copy live provider credentials or sessions. Initial test database/account provisioning remains a hosting setup step; the new sign-in gate does not expose the legacy sample-seeding API anonymously. Existing platform-owner provisioning procedures can be used against the verified separate database.

Test deployments do not run automatic message/report schedulers. The shared email/text provider resolver returns no sending credentials there, even if credentials were mistakenly copied; card charging also refuses test-site calls. Sending on the existing GroomPro sample business is unchanged. Testing actual delivery later needs a separately approved test-recipient/provider setup. Maps/AI and other integration credentials must be independently scoped; this preparation does not provision them.

## Environment Settings

Set `GROOMPRO_SITE_ROLE` to the role above and `GROOMPRO_SITE_HOSTS` to comma-separated exact hostnames for that deployment, without scheme, port or path. Include its actual preview hostname during verification. Unknown hostnames are rejected. Leave business-subdomain routing off on sales, admin, development and staging. Those areas belong on separate apps.

Suggested addresses once the domain is chosen: `www.DOMAIN`, `dev.DOMAIN`, `admin.DOMAIN`, `app.DOMAIN`, `staging.DOMAIN`. Business-specific addresses point to the tenant app using the existing configuration in `subdomain-routing.md`. No address is created or registered by setting these variables.

Sales accepts optional HTTPS links in `GROOMPRO_PUBLIC_LOGIN_URL`, `GROOMPRO_PUBLIC_SIGNUP_URL` and `GROOMPRO_PUBLIC_HELP_URL`. Only configured links appear. Optional `GROOMPRO_PUBLIC_PLANS_JSON` accepts an approved public array of `{name, monthlyCents, features: string[]}`. It is independent of the private plan editor, so editing a private plan never silently publishes pricing. Pricing is deliberately not invented; the page states that plan information and registration are not yet published. The signup link is an access-request destination, not paid automatic enrollment. The approved sales questionnaire now selects and orders personalized sales and training outlines. The planned format is actual GroomPro screen recordings with friendly AI narration. Recordings and narration are not yet produced; the results explicitly say so.

## Release and Rollback

1. Confirm hosting supports five separate apps, the required domain mappings and SSL renewals. Await case #02211043 for unconfirmed limits; do not assume a wildcard is supported.
2. Choose the domain and configure each app’s exact hostnames. Keep the current site unchanged while preview apps are checked.
3. Provision isolated development/staging databases and restricted users; configure independent secrets and test accounts. Verify the live database name and backup/restore procedures.
4. Build and test a commit in Development. Deploy that exact commit to Staging. Verify existing appointments, prices, tax, tips, permissions and tenant isolation using fictional data.
5. Obtain release approval, back up production, and deploy the reviewed commit to Administration/Tenant. Never synchronize a development/staging database into production. Retain the previous application build for rollback; database migrations require separate review.
6. Verify anonymous and ordinary employee access cannot read administration/development data; staging requires its test employee PIN. Confirm unknown hosts fail closed, production schedules have only one runner, and sales cannot reach business APIs.
7. Publish the sales destination and only then attach approved production business addresses. Preserve current addresses through the existing routing allowlist.

To roll back site-role preparation on the existing app, leave the role unset and business routing off, as they are now. For newly separated apps, restore the previous reviewed deployment/configuration; never point a test app at the live database to bypass a setup error.

## Not Yet Live / Still Required

Chosen domain; GoDaddy hostname and certificate confirmation; separate app/database provisioning; independent deployment secrets and accounts; final public plan pricing and signup/help destinations. Billing, 123Pet backup, automatic DNS creation, personalized videos, release automation and a new monitoring/AI-cost dashboard are not included. Existing administration capabilities remain available; this preparation does not claim those additional systems exist.

## Personalized Sales Questionnaire

The public sales page includes a four-step questionnaire for business type/team size, current recordkeeping/software and booking methods, services, and up to three ordered priorities. Visitors receive a priority-first sales outline and a working-day training outline. They can switch between both without losing answers, edit their answers or start over.

Answers are held only in session storage for the browser tab, under `groompro:sales-questionnaire:v1`. Nothing is submitted to business APIs, lead lists or AI services. Reloading can resume the questionnaire in the same tab; storage-unavailable browsers remain usable and show a notice. No customer or contact details are requested. Saved input is normalized against known choices.

The topic library is in `src/lib/sales-questionnaire.ts`; the client form is in `src/components/sales-questionnaire.tsx`. Topic selection does not change subscriptions, promise imports from named competitors, or imply Maps, AI, payment processing or message delivery are connected. There are no pretend video players or recording-complete claims. Screen capture, narration, video hosting and publishing approved recordings remain the next phase, separate from this questionnaire release.
