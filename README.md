# RinkCircuit

Adult hockey discovery directory built with React, Vite, Express and Supabase PostgreSQL. The application no longer uses a local SQLite database.

## Local setup

Use Node.js 22.12 or newer. Install with `npm ci`, copy `.env.example` to `.env` if you do not already have one, and configure the server variables. Never overwrite an existing credentials file.

Connection preference is `SUPABASE_TRANSACTIONAL_POOLER_URL`, then `SUPABASE_SESSION_POOLER_URL`, then `SUPABASE_DATABASE_URL`. Use the exact transaction-pooler URI from Supabase's Connect panel for Vercel. The pool uses unnamed parameterized queries and verifies TLS using the included public Supabase CA certificate. No anon key or service-role API key is needed for this direct PostgreSQL integration.

Set `ADMIN_USER`, a strong random `ADMIN_TOKEN`, and `APP_URL` (the public site origin). Database credentials and admin keys must remain server-only; never prefix them with `VITE_`. Existing contact addresses and the Plaionn operator disclosure are separate from the RinkCircuit brand.

Admin login exchanges the configured security key for an eight-hour database session. The browser receives an HttpOnly, SameSite=Strict cookie (Secure in production) and an in-memory CSRF token; the permanent key is no longer returned or stored in local storage. Legacy stored keys are removed on opening the admin screen, and `x-admin-token`/Bearer master-key access is rejected. Logout revokes the session; changing `ADMIN_TOKEN` invalidates existing sessions. Authenticated writes require the CSRF header, and audit actors come from the session. `APP_URL` must match the browser origin for login. The Vite proxy preserves the host for local development. This is still a single configured administrator, not individual accounts or MFA.

Session hashes live in the private `admin_sessions` table and are intentionally excluded from data backups. The admin restore endpoint revokes active sessions after restoring data. Expired sessions are cleaned up during successful login.

Team publication requires explicit consent on that submission and a verified captain email. The consent wording and timestamp are retained separately from marketing consent. Declining publication still records private interest; older submissions default to no publication consent, and retrying a submission does not silently change its consent. Existing published profiles are preserved by migration. Moderation decisions are atomic and final: repeated decisions return 409, rejected teams leave the pending queue, and concurrent approvals cannot create duplicate profiles. Public team fields exclude captain contacts.

Ownership-claim approval requires an explicit evidence-review confirmation and notes explaining how authority was verified. It records claimed status and increments the programme version, without verifying unrelated programme facts or granting login access. Approved corrections/removals record the review decision; the corresponding editorial change remains a separate admin action. These records are private and audited under the authenticated admin identity.

```sh
npm run db:migrate
npm run seed
npm run dev
```

The frontend runs on port 5173 and proxies `/api` to port 3001. `npm run build` creates `dist`; `npm start` serves the built frontend and API locally. `/api/health` checks database readiness.

## Database and research data

Versioned SQL migrations live in `server/db/migrations`. They apply transactionally under an advisory lock, record checksums, and can safely run again. Run migrations explicitly before starting/deploying a new database version; requests never create tables.

Application tables use the dedicated `rinkcircuit` schema. In Supabase's table editor, select that schema. Existing tables in other schemas are untouched. All app tables have row-level security enabled, and the schema is not accessible to the `anon` or `authenticated` roles. The backend connects with the configured privileged database credential and enforces its own public projections and admin authorization. Do not expose this schema through the browser's Supabase client.

`npm run seed` is a non-destructive research staging command. It stages the 79 records from `server/data/extracted_leagues.json`, deduplicated by a source fingerprint. It does not erase tables, publish researched candidates, or generate fake leagues, fees, dates, teams, leads or events. The original SQLite file was absent, so there was no live local database to transfer.

Review saved batches under Admin > Spreadsheet Staging Tool. Select reviewed rows explicitly before committing. Unresolved applicants remain drafts; invalid and conflicting rows are skipped. Existing programme records require separate editorial changes rather than automatic research overwrites. Unknown availability, fees and playing nights remain unknown. Staged research is private and may contain contact/outreach details.

Both new previews and saved batches show current versus incoming name/area/category, source links, source-check dates and freshness labels. Planned actions distinguish publication, draft creation, preservation of an existing record and unresolved review. Dates come from the workbook, not a new source verification. Existing matches cannot be selected for overwriting; changes since staging are flagged, and commit rechecks for matching records created after staging. Batch status remains partially reviewed while pending rows exist, and the review stays visible after a commit. Private raw notes/contact fields are excluded from this review response.

Paste CSV with `League,Area,Category,Source` headers (supported aliases: `name`/`Programme Name`, `area`/`City`, `category`, `source`/`url`). Additional research columns are retained privately. Server parsing supports quoted commas, escaped quotes, multiline fields, CRLF and empty cells. Missing/duplicate headers, conflicting aliases, malformed quotes and inconsistent column counts are rejected before staging. Limit uploads to 1,000 rows and 1.5 MB of CSV text.

Pending rows can be corrected or rejected in the review screen with a required reason. Corrections change only staged name, area, category and source; original research is preserved. Source changes reset the displayed/source check date to unknown. Applicant restrictions are retained until separate editorial identity review. Rejections and before/after corrections are audited. Version checks reject stale row edits and stale commit selections; refresh the preview after a conflict. Reviewed rows cannot be reopened through these endpoints. Duplicate rows within a batch must be rejected or corrected before committing. Nothing is published by saving a correction.

`npm run db:status` displays table counts without contact information or credentials.

## Deploying to Vercel

The repository includes `vercel.json` and `api/index.js`: Vite builds the frontend and the Express API runs as a Node function. API requests route to the function; public routes use the SPA fallback. The public CA certificate is included with the function.

1. Import the repository into Vercel and use Node.js 22 or newer.
2. Configure `SUPABASE_TRANSACTIONAL_POOLER_URL`, `ADMIN_USER`, `ADMIN_TOKEN` and `APP_URL` in Vercel environment variables. `APP_URL` should be the final HTTPS origin.
3. Apply `npm run db:migrate` against that environment before deployment.
4. Build/deploy, then verify `/api/health`, public directory routes and admin login.

Use separate Supabase projects/credentials for preview and production where possible. A build does not run migrations, seed data, or publish listings. No deployment or domain configuration is performed by the migration itself.

## Verification

```sh
npm run test:unit
npm test
npm run build
node tests/verify-server.js
```

`npm test` creates a uniquely named `rinkcircuit_test_*` schema in the configured database, applies migrations, runs real API/database assertions, and drops only that test schema afterward. It requires schema-creation privileges. The normal application schema is not used for fixtures. Tests cover transactions, filtering, publication/privacy, admin authentication, duplicate concurrent submissions, verification, moderation, imports, concurrency and backup restoration. They are migration regression checks, not a claim that every product acceptance criterion is complete.

The admin diagnostics button performs read-only table/RLS checks. It does not execute fixture-writing tests against live data. `tests/verify-server.js` provides a read-only smoke check after building.

Public interest, listing-request, verification and resend forms validate input types and lengths before database work. Marketing consent accepts explicit booleans only; malformed arrays, roster counts and unsafe evidence URL schemes are rejected with field-specific errors. Unit checks exercise these boundaries. Duplicate interest receipts reflect the lead's current verification state without creating another queued message.

Supabase-backed throttling applies a separate 15-minute window per client address and endpoint: interests 20, listing requests 10, verification attempts 30, resends 5, admin logins 10. Excess attempts return 429 with `Retry-After`. Failed validation also consumes attempts; public browsing is unaffected. Counters use database time and atomic updates across instances. Submissions return 503 if the limiter cannot reach the database.

Throttle identifiers are HMAC hashes using `RATE_LIMIT_SECRET` (or `ADMIN_TOKEN`); raw addresses are not stored in the counter table. Expired counters older than one day are removed in bounded batches during subsequent submissions, not by a retention scheduler. Rotating the secret resets effective limits. Local hosting uses socket addresses and ignores forwarding headers. In the Vercel runtime, the limiter uses the platform-overwritten forwarding header ([Vercel documentation](https://vercel.com/docs/headers/request-headers)); other proxy deployments need explicit trusted-proxy configuration. Per-address limits are a baseline: shared networks share limits, and distributed bot traffic needs further controls.

See [TODO.md](TODO.md) for the ordered implementation checklist and remaining acceptance work.

## Backups and email

Authenticated `/api/admin/backup` exports all application tables from a consistent snapshot. `/api/admin/restore` requires a complete versioned backup and restores every table in one transaction. Restore replaces the application's data; test recovery in a separate environment first. Backups contain private data and must be protected. Scheduled backups and recovery operations still need deployment configuration.

Verification tokens and pending messages are persisted in PostgreSQL's `email_verifications` and `email_outbox` tables. Tokens are never returned in public submission responses. SMTP delivery is implemented using Nodemailer, but remains disabled until configured and enabled.

### SMTP setup and operation

1. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` and `APP_URL`. `SMTP_FROM` must be a bare approved sender address. Use port 587 with required STARTTLS, or 465 with immediate TLS; certificate verification stays enabled ([Nodemailer SMTP options](https://nodemailer.com/smtp)). Production `APP_URL` must use HTTPS. Configure sender DNS with your provider and use a production origin before collecting live submissions.
2. Keep `SMTP_ENABLED=false` and run `npm run email:verify`. This checks connectivity, TLS and authentication without sending mail; it does not prove sender permission or inbox delivery.
3. After configuration and an approved delivery test, set `SMTP_ENABLED=true`. `npm run email:deliver` processes up to five queued messages per invocation. It sends actual queued email, so do not run it merely to check configuration.
4. Configure a scheduler to invoke `GET /api/jobs/email` with `Authorization: Bearer <CRON_SECRET>` every minute. This processes one message per call. The endpoint requires its own nonempty secret and returns only aggregate counts. No schedule is enabled in `vercel.json`; choose a scheduler/plan with sufficient frequency before launch ([Vercel cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)).

Queue states are `pending`, `processing`, `sent`, `failed`, `uncertain`, and `cancelled`. Atomic claims prevent concurrent workers from sending the same queued row. Temporary explicit SMTP rejections retry with exponential delays (up to five attempts); permanent rejection fails immediately. Expired or already-used verification messages are cancelled. Provider responses and credentials are not stored in error fields.

`sent` means the SMTP server accepted the message, not that it reached the inbox. A timeout or interrupted worker can leave the SMTP outcome unknown; such rows become `uncertain` and require review of provider logs before any manual resend. Stable Message-ID values help investigation but do not guarantee recipient deduplication. Review failed/uncertain rows in the private Supabase outbox; no automated manual-review UI is provided yet. Later bounce events require provider-specific webhook or mailbox integration, which remains unfinished. Step 11 stays open until credentials, sender/domain, scheduling and a controlled end-to-end delivery test are completed.

Other previously identified product work remains: full accessibility/performance validation, approved policies, SEO, comprehensive spam controls and further moderation refinements. See `RinkCircuit_Developer_Package` for the client requirements. Its November 14 edit removes the Champions League page.


## SEO, analytics and QA (2026-11-20)

The project directory is `rinkcircuit-directory`. Preserve the ignored `.env` and keep preview and production database credentials separate. Run migrations before starting a newly updated API: `npm run db:migrate`. Migration 008 is required by operational counters.

Configure the deployed `APP_URL` to the canonical public origin (the supplied deployment is `https://rink-circuit-hocky.vercel.app`). Leave `PUBLIC_INDEXING_ENABLED=false` until content and policies are approved. Vercel preview deployments remain noindex even when that flag is true. Sitemap entries cover published leagues, teams and eligible events; city pages stay noindex until curated editorial content is approved. Archived/draft league profiles and their old slugs return 404. Slug history is reserved to avoid redirect collisions.

`ANALYTICS_ENABLED=false` disables optional browser counters. Visitors must also opt in on the privacy page. Counters contain only a predefined event name, UTC day and count, with no visitor identifier or free text. Operational submissions/verification/approval counters run server-side in the relevant transactions. Raw interest requests include successful retries; distinct verified demand excludes rejected interests. Night/city/type groups overlap and must not be summed into a global total. Event team counts include linked approved team IDs only. Referral clicks are not registrations or paid entries. Counts begin when instrumentation is installed, not at the start of historical data.

Run `npm run test:seo`, `npm run test:analytics`, `npm run test:browser`, and `npm run test:performance` alongside `npm test`, `npm run test:unit`, and `npm run build`. Browser checks require installed Microsoft Edge and use mock public fixtures. Reports are in ignored `artifacts/qa/`; the API/load suites create and remove dedicated `rinkcircuit_test_*` schemas. No test suite should be pointed at a public deployment for fixture writes. The recorded local load baseline misses the one-second p95 target; deployed performance and manual screen-reader testing remain required.

## Operations and release handover

`npm run healthcheck` checks the supplied Vercel URL by default. Set `HEALTHCHECK_URL` for a different environment. It exits nonzero on API errors or unexpected response shapes. An external uptime service and its owner/alert destination are still required; this command does not install a schedule or send alerts.

For encrypted application backups, configure a private `BACKUP_ENCRYPTION_KEY` consisting of 64 random hex characters. Store a separate recovery copy of this key; losing it prevents recovery. Run `npm run backup:export`. This creates an AES-256-GCM encrypted file under ignored `private-backups/`, never overwrites an existing file, excludes admin sessions, and records an audit event. Copy it to owner-controlled off-site storage. No off-site destination, retention period or automated schedule is selected on the owner's behalf. Check a file with `node scripts/backup.js --inspect private-backups/<file>.json.enc`; inspection authenticates/decrypts it and reports table counts without restoring or printing private rows.

Recovery: prepare a separate Supabase environment, apply migrations, decrypt using `server/services/backupEncryption.js`, and restore with `server/db/backup.js`. `restoreBackup` replaces every application table transactionally; use it only against the explicitly chosen recovery database. Validate relationships, evidence and queue state with the acceptance suite in its isolated schema and read-only smoke checks against the recovered app. Restore does not restore active admin sessions. Before switching traffic, review pending/uncertain SMTP messages to avoid duplicate mail. Proposed RPO 24 hours/RTO one business day are targets requiring a scheduled off-site setup and measured owner-approved drill, not promises.

Deployment: authenticate with `npx vercel login`, then `npx vercel link` and choose the existing owner-controlled project. Set server-only database, admin, APP_URL and optional SMTP/cron variables in the intended environment; never expose them through VITE_ variables. Run a preview deployment first and verify `/api/health`, `/api/leagues`, page metadata, sitemap/noindex, login/CSRF and forms with approved test data. The supplied live URL currently returns 404 for API paths, so API routing/function deployment must be validated before UAT. No production deployment has been performed from this session. Keep the previous deployment available for rollback; reverting application code does not reverse database writes or published content.

Remaining owner dependencies: reviewed public content and policies, retention/deletion rules, sender identity and controlled SMTP delivery, Vercel project access/environment separation, off-site backup destination/key custody, monitoring/alert ownership, and staging UAT. SMTP stays deferred and disabled until its setup is ready.
