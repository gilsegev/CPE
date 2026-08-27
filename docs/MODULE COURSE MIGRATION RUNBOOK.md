# Module-Based Course Migration Runbook

This runbook applies the additive Directus schema and migrates one approved legacy course at a time to the module-based course model. Legacy course behavior remains active until a course passes validation and its `structure_version` changes to `module_quiz_v2`.

## Safety contract

- Schema installation is idempotent and does not delete legacy course, progress, submission, or certificate records.
- Content migration is disabled by default and requires `--execute`.
- Every migrated course requires an owner-approved manifest with explicit module CPE values and quiz ownership.
- Existing duplicate certificates require an explicit canonical certificate choice; duplicate historical rows remain unlinked and are not deleted.
- The course version changes only after configuration, learner evidence, and canonical certificates reconcile.
- Existing certificates are backfilled to `issued`; schema installation does not emit certificate-create events or invoke n8n.

## Environment

The migration needs the application service's `NEXT_PUBLIC_DIRECTUS_URL` and `DIRECTUS_ADMIN_TOKEN`. Schema installation also needs a PostgreSQL connection string in `MODULE_COURSE_DB_URL` or `DB_CONNECTION_STRING` so database constraints are not merely application conventions.

When running locally against Railway, inject the PostGIS service's public database URL without writing it to disk:

```powershell
$pgVariables = railway variables --service PostGIS --json | ConvertFrom-Json
$env:MODULE_COURSE_DB_URL = $pgVariables.DATABASE_PUBLIC_URL
railway run --service CPE npm run migration:module-courses -- schema --execute
```

## Workflow

```text
Install additive schema
        |
        v
Generate live dry-run manifest
        |
        v
Course owner supplies CPE, quiz, and certificate decisions
        |
        v
Validate without writes
        |
        v
Execute approved courses only
        |
        v
Verify reconciliation and course activation
```

Generate the local manifest:

```powershell
railway run --service CPE npm run migration:module-courses -- manifest --output migration/manifests/module-course-v2.production.local.json
```

For each course, keep `action` as `defer` until all of these are resolved:

- Set each content module's non-negative integer `cpeValue`; the sum must equal `legacyCourseCpe`.
- Confirm each quiz owner by copying the approved module ID into `approvedContentModuleId`.
- For every certificate group, choose one `canonicalCertificateId` from its listed IDs.
- Set `approval.approved` to `true`, record the approver, and use an ISO-8601 approval time.
- Change `action` to `migrate`.

Validate without writes:

```powershell
railway run --service CPE npm run migration:module-courses -- apply --manifest migration/manifests/module-course-v2.production.local.json
```

Apply only after validation reports `"executable": true`:

```powershell
railway run --service CPE npm run migration:module-courses -- apply --manifest migration/manifests/module-course-v2.production.local.json --execute
```

Verify the result, including PostgreSQL constraints and administrator-only feedback permissions when the database environment variable is available:

```powershell
railway run --service CPE npm run migration:module-courses -- verify
```

## Test

Run `npm run test:migration`, `npx tsc --noEmit`, and the live `verify` command. Validate the production manifest once before approval to prove the negative path makes no content changes.

## Pass when

- Schema verification reports `complete` with no missing database constraints.
- No non-administrator Directus policy or role has a `FeedbackResponses` permission.
- An unapproved or stale manifest returns `executable: false` and changes no course version.
- Every approved course reports `migrated_and_activated` exactly once; a rerun reports `already_migrated`.
- Existing submissions and duplicate historical certificate rows remain present.
- Each selected canonical certificate links to one immutable course completion without generating or emailing another certificate.
