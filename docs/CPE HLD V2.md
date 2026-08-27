# CPE Training Platform — High-Level Design

## Business architecture

The platform lets an individual educator purchase a self-paced course, complete ordered learning modules and their configured knowledge checks, earn a durable CPE award, receive a certificate asynchronously, and optionally provide identified course feedback.

```text
Authenticate -> Purchase -> Complete module content -> Pass configured quizzes
             -> Course completion + CPE snapshot -> Certificate fulfillment
                                                -> Optional feedback
```

Course completion is determined by server-side evidence. Certificate fulfillment and feedback are downstream processes: neither can revoke, delay, or duplicate the award.

## System responsibilities

| Component | Responsibility |
| --- | --- |
| Next.js application | Authenticates learners, authorizes purchases, enforces module order, scores quizzes, creates completion evidence, validates feedback, and exposes administrator recovery operations. |
| Directus and PostgreSQL | Store course configuration, learner evidence, immutable awards, certificate work, feedback, and uniqueness constraints. |
| Mux | Hosts and streams module video. |
| Square | Processes payment; the application stores only purchase state and provider references. |
| n8n | Claims pending certificate work, generates and stores the PDF, sends email, records delivery, and reconciles missing or stuck work. |
| Administrator observability | Reports course completions, feedback, technical journey events, and certificate failures without treating telemetry as business evidence. |

## Core model

```text
Course 1 -> 1..* ordered Module 1 -> 0..1 enabled Module Quiz -> 1..* Question
                           |
                           +-> non-negative integer CPE value

Learner + Module -> UserProgress
Learner + Quiz   -> immutable QuizAttempts
Learner + Course -> one CourseCompletion -> one Certificate
                                      |
                                      +-> zero or one FeedbackResponse
```

For a `module_quiz_v2` course, the module CPE sum is the learner-visible course total. The completion and certificate copy that value so later configuration edits do not rewrite an earned award.

The certificate lifecycle is `pending -> processing -> issued -> delivered`, with sanitized `failed` evidence and controlled retry. n8n receives only the certificate ID and uses the certificate's snapshot fields; it never reads an essay submission or current module CPE.

## Security boundaries

- Public users may browse published catalog data and free previews only.
- Learner commands require authentication, an active purchase, and a valid course-to-module-to-quiz relationship.
- The browser cannot set scores, pass results, completion timestamps, CPE awards, certificate status, or learner identity.
- Correct answers are withheld until the corresponding answer is submitted.
- Learners cannot read another learner's progress, attempts, completion, certificate, or feedback.
- Feedback comments and certificate failure detail are administrator-only and rendered as plain text.
- n8n uses a least-privilege service credential and stable certificate ID for idempotency.

## Migration and coexistence

Legacy and v2 courses coexist behind `Courses.structure_version`. Migration is additive and course-scoped:

1. Install the Directus schema and PostgreSQL constraints.
2. Generate a live dry-run manifest.
3. Obtain explicit owner approval for module CPE, quiz ownership, and canonical historical certificates.
4. Validate the unchanged live inventory without writes.
5. Migrate configuration and the furthest defensible learner evidence, reconcile historical certificates, and activate that course.
6. Observe production completions and run `cleanup-check`.
7. Retire compatibility readers and writes only when every course is v2 and reconciliation is clean.

Standalone quiz and essay modules, `QuizProgress`, `Submissions`, `Modules.type`, `UserProgress.is_completed`, and `Courses.cpe_hours` remain compatibility-only during coexistence. Historical rows are retained until a separate retention decision authorizes physical deletion.

Operational detail is in the [module-course migration runbook](./MODULE%20COURSE%20MIGRATION%20RUNBOOK.md) and [completion and certificate runbook](./COURSE%20COMPLETION%20AND%20CERTIFICATE%20RUNBOOK.md).

## Verification gates

### Test

1. Run migration, completion, feedback, and certificate workflow contract tests.
2. Run TypeScript, lint, and the production build.
3. Run the live migration verifier with database constraint access.
4. Prove an unapproved or inventory-stale manifest changes no course.
5. Exercise one-module and multi-module completion, failed retake, duplicate final submission, feedback close/submit, certificate failure/retry, and migrated-certificate replay scenarios.

### Pass when

- Module sums match every learner-visible CPE total and immutable award snapshot.
- Failed quizzes and incomplete prerequisites cannot create a completion.
- Duplicate requests converge on one completion, certificate record, and accepted email.
- Certificate failure remains observable and retryable without changing completion.
- Feedback is optional, unique per completion, and administrator-only.
- Migration preserves defensible progress and existing certificates without silent guessing or reissuance.
- `cleanup-check` reports ready before any compatibility behavior is removed.
