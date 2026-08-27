# n8n Workflows

This directory contains version-controlled `.json` files representing your n8n automation pipelines.

## Sync Instructions

*   Run `npm run n8n:pull` to download the latest workflow state from your Railway instance to this folder.
*   Run `npm run n8n:push` to upload local workflow definitions from this folder to your Railway instance.

## Certificate fulfillment

`Certificate Generation Pipeline` accepts only a certificate work ID at `POST /webhook/pending-certificate`. It conditionally claims a `pending` record, generates from the stored learner/course/CPE snapshots, updates that same record to `issued`, sends with the certificate ID as the Resend idempotency key, and marks it `delivered`. Terminal failures are sanitized and stored as `failed` after three transient retries.

`Certificate Reconciliation` runs hourly. It calls the application's protected reconciliation endpoint, repairs completions that are missing certificate work, marks timed-out processing records as retryable failures, and replays pending certificate IDs through the worker.

Configure these n8n environment variables before activation:

- `CPE_APP_URL` is the deployed application origin without a trailing slash.
- `CERTIFICATE_RECONCILIATION_SECRET` must match the application secret of the same name.

Configure `N8N_CERTIFICATE_WEBHOOK_URL` in the application to the production `pending-certificate` webhook. A Directus create event for `Certificates` may call the same webhook with its standard `keys` payload; duplicate invocations are expected and safely exit after one conditional claim.

The Google Docs template referenced by the worker must include `{{cpe_earned}}` in addition to the learner, course, TEA ID, and issued-date placeholders; fulfillment never rereads current module values.

Run `npm run test:certificate-workflow` before pushing either workflow. After pushing, activate both workflows explicitly in n8n because version-controlled workflow files do not change remote activation state.
