# Course Completion and Certificate Runbook

This runbook operates the `module_quiz_v2` completion path. A course completion is the durable award; its certificate is an asynchronous fulfillment record and may fail without revoking the award.

## Deployment order

1. Apply and verify the additive Directus schema with the module-course migration command.
2. Deploy the Next.js application with the environment below.
3. Push the n8n workflows and activate `Certificate Generation Pipeline` and `Certificate Reconciliation`.
4. Confirm the configured Google Docs certificate template contains `{{legal_name}}`, `{{course_title}}`, `{{cpe_earned}}`, `{{tea_id}}`, and `{{issued_date}}` placeholders.
   Connect both the n8n Google Drive and Google Docs credentials, and keep the Google OAuth consent screen in **Production** status. Credentials issued while the consent screen is in **Testing** expire after seven days and stop certificate fulfillment until they are reconnected.
5. Configure a Directus `Certificates` create event to post its standard event body to the n8n `pending-certificate` webhook.
6. Migrate and activate one approved course only after its final content module owns an enabled quiz and its module CPE sum is positive.

The application also dispatches a newly created certificate ID directly as an immediate fast path. The Directus event and hourly reconciliation are deliberate duplicate/recovery paths; the worker's conditional claim makes replay safe.

## Application environment

```text
N8N_CERTIFICATE_WEBHOOK_URL=https://<n8n-host>/webhook/pending-certificate
CERTIFICATE_RECONCILIATION_SECRET=<shared-random-secret>
CERTIFICATE_PROCESSING_TIMEOUT_MINUTES=30
```

The same reconciliation secret must be available to n8n. Set `CPE_APP_URL` in n8n to the application origin.

## Expected lifecycle

```text
Final passing quiz
        |
        v
One CourseCompletion + one pending Certificate
        |
        v
pending -> processing -> issued -> delivered
                         |
                         +-> failed -> administrator retry -> pending
```

An administrator retries a failed work item with `POST /api/admin/certificates/{certificateId}/retry`. The endpoint requires an authenticated Administrator role, clears only sanitized failure fields, returns the work to `pending`, and dispatches it when the worker URL is configured.

## Feedback and observability

The completion response opens the optional course survey. Closing it records only `survey_closed`; it creates no feedback record and does not change completion or certificate state. Until a response exists, the completed-course dashboard exposes **Provide feedback**. A successful submission creates one immutable `FeedbackResponses` record linked to the learner's `CourseCompletion` and replaces that action with a thank-you state.

`POST /api/courses/{courseId}/feedback` accepts answer values only. The application derives the authenticated learner, active purchase, course, completion, and submission time. Ratings outside `1..5`, over-limit text, unsupported technical-issue categories, contradictory intent answers, incomplete courses, and duplicate responses are rejected.

The administrator observability page separates two evidence sources:

- **Journey telemetry** uses allowlisted, sanitized `UserActivityLogs` events for diagnostics.
- **Course Feedback** uses `CourseCompletions` and `FeedbackResponses` for response rates, averages, distributions, issue counts, and the paginated response table; it also lists retryable certificate failures.

The Course Feedback date filter applies to `completed_at`. A response is counted when its linked completion is in the selected range, even when the response was submitted later. Directus schema verification fails if a non-administrator policy or role can access `FeedbackResponses`.

## Test

Run:

```powershell
npm test
npm run lint
npm run build
```

In a non-production Directus/n8n environment, verify these integration cases:

1. Submit a failing final quiz and confirm no course completion or certificate exists.
2. Pass the final quiz twice concurrently and confirm one completion, one certificate, and one accepted email.
3. Edit module CPE after completion and confirm the completion, PDF data, and dashboard award retain the snapshot value.
4. Force the email provider to fail and confirm the course stays completed while the certificate becomes `failed`.
   Separately disconnect each Google credential and confirm the certificate becomes `failed`, remains visible in observability, and succeeds after reconnection plus one administrator retry.
5. Retry the failed certificate and replay the same certificate ID after delivery; confirm no second email is accepted.
6. Create a completion without a certificate in the test database and confirm hourly reconciliation creates one pending work item.
7. Close the completion survey and confirm no `FeedbackResponses` record exists, certificate processing continues, and **Provide feedback** remains on the dashboard.
8. Submit one valid response and confirm the dashboard shows the thank-you state and Course Feedback reports it against the linked completion date.
9. Repeat the submission and submit an invalid rating or unsupported technical category; confirm both fail without changing the completion or certificate.
10. Request the feedback endpoint while signed out and the administrator observability page as a learner; confirm the endpoint returns `401` and the page redirects away from administrator data.

## Pass when

- Completion is created only from complete server-side module evidence and a passing final quiz.
- Replayed or concurrent final submissions converge on one immutable award and certificate work item.
- Dashboard and completion views show the module-summed CPE snapshot and current certificate status.
- A certificate failure is visible and retryable without changing course completion.
- The provider accepts at most one email for a certificate ID.
- Survey dismissal has no business side effect; one valid response is persisted at most once and remains independent of certificate fulfillment.
- Feedback response rate is completion-linked, `Not applicable` intent is excluded from the intent average, and comments remain administrator-only plain text.
