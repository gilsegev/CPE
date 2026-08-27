# TECHNICAL DESIGN — Module-Based CPE Courses, Completion, Certificates, and Feedback

> **Document type:** Technical Design
> **Status:** Partially approved — all product-behavior decisions were accepted on 2026-08-26; phased delivery and migration inputs remain pending
> **Date:** 2026-08-26
> **Requirements:** [CPE B2C Product Requirements](./requirements%20for%20CPE%20B2C%20.md)
> **Scope:** Requirement 2 course structure, module quizzes, course completion, certificate generation, feedback persistence, and feedback observability

## 1. Executive decision

Adopt a module-centered course model in which every course contains one or more ordered content modules, each module owns its CPE value, and a module may own one configurable quiz. The application server is the authority for module and course completion. Directus is the system of record, and n8n remains the asynchronous certificate worker.

Course completion becomes a durable, one-time business event rather than a percentage inferred from mutable progress rows. That event snapshots the awarded CPE and creates exactly one pending certificate record. The certificate record is the reliable work item processed by n8n. The optional survey is presented after completion but is stored independently and never participates in certificate eligibility.

This design replaces the current certificate gate based on an approved essay submission.

## 2. Why a design change is required

The current implementation does not represent the requested business behavior:

- Video, quiz, and essay records are peer entries in the course module sequence.
- Module progress is represented by one mutable completion boolean.
- A failed quiz is recorded as completed in quiz progress and is destructively reset for a retake.
- Course progress is calculated by counting completed module records.
- The existing n8n certificate workflow is triggered by an `Approved` essay submission.
- Course CPE is stored at course level rather than calculated from modules.
- Survey responses do not have a dedicated business collection or reporting view.

Changing only the learner interface would leave these contradictions in the persistence and certificate paths. The target model therefore changes the completion boundary and introduces migration and idempotency rules.

## 3. Goals and non-goals

### Goals

1. Represent a course as one or more ordered content modules.
2. Make module CPE values the authoritative source for the course total.
3. Attach zero or one enabled quiz to each module.
4. Preserve resumable learning and quiz work without erasing attempt history.
5. Record course completion once after all module requirements are satisfied.
6. Generate and deliver one certificate from an immutable completion snapshot.
7. Persist optional course feedback in Directus and report it in the administrator observability experience.
8. Migrate existing courses and learner evidence without accidental reissuance.

### Non-goals

1. A manually graded case study or essay.
2. Multiple certificates for repeat viewing of the same purchased course.
3. Multiple-correct-answer quiz questions.
4. Full content versioning for a course after learners have enrolled.
5. Delayed surveys measuring classroom impact after the course.
6. Replacing Directus, n8n, Mux, Square, or the current email provider.

## 4. Accepted decisions

These decisions resolve the open questions in the requirements and were accepted by the product owner on 2026-08-26.

| Decision | Accepted resolution | Reason |
|---|---|---|
| Module CPE precision | Store a non-negative integer and require a certificate-awarding course total greater than zero. | CPE is awarded in whole-number units, so fractional storage is unnecessary. |
| Existing content migration | Use an additive schema migration and a dry-run migration manifest; do not infer ambiguous quiz ownership or module CPE allocation. | Incorrect CPE or quiz mapping is worse than requiring an administrator decision. |
| Survey after dismissal | Dismiss it for the current completion interaction, but retain a **Provide feedback** action on the completed-course dashboard until submitted. | Keeps the survey optional without making an accidental close irreversible. |
| Feedback identity | Store identified responses linked to the learner and completion; expose them only to administrators. | Enforces one response per completion and supports follow-up on technical problems. |
| Certificate retry ownership | n8n retries transient failures up to three times; terminal failures appear in the administrator view with an explicit retry action. | Automates ordinary recovery while keeping repeated external failures visible and controlled. |

## 5. Domain model and invariants

The canonical business language is recorded in [CONTEXT.md](../CONTEXT.md).

### Course structure

```text
Course 1 ──── 1..* Module 1 ──── 0..1 Module Quiz 1 ──── 1..* Question
                    │
                    └──── CPE value
```

The following invariants must be enforced on server writes and course activation:

1. A course has at least one module.
2. Module order is unique within a course.
3. A module belongs to exactly one course.
4. A module has a non-negative integer CPE value.
5. A module has at most one quiz, and a disabled quiz does not affect completion.
6. An enabled quiz has at least one ordered question and a passing score from 0 through 100 inclusive.
7. The final module of a certificate-awarding course has an enabled quiz.
8. Module completion is monotonic for a completed course; repeat viewing cannot revoke it.
9. There is at most one course completion for a learner and course.
10. There is at most one certificate for a course completion.
11. There is at most one submitted feedback response for a course completion.

### Completion rules

```text
Module without quiz:
content incomplete ──content completed──> module complete

Module with quiz:
content incomplete ──content completed──> quiz available
quiz available ──failed attempt──> quiz available
quiz available ──passed attempt──> module complete

Course:
any module incomplete ──> in progress
all modules complete + final quiz passed ──> completed once
```

An enabled quiz cannot be started until its module content is complete. After content completion, the module page presents a **Continue to Quiz** action that opens a dedicated quiz route for that module. The quiz is not rendered inline beneath the content and is not represented as another module in the course order. A later module cannot be started until the preceding module's quiz is passed.

### Certificate fulfillment

```text
pending ──claimed by n8n──> processing ──PDF stored──> issued ──email accepted──> delivered
   ▲                            │                              │
   └──────── retry ───── failed <──────── workflow error ─────┘
```

The course completion remains valid if certificate fulfillment fails. Certificate status describes fulfillment, not learner eligibility.

## 6. Target Directus data model

All collection and field names below are implementation contracts. Existing names are retained where doing so avoids unnecessary migration.

### Existing collections to extend

#### `Courses`

| Field | Type | Rule |
|---|---|---|
| `structure_version` | string choice | `legacy` or `module_quiz_v2`; defaults to `legacy` for existing records. |
| `cpe_hours` | existing numeric field | Compatibility-only during migration; not used to award new v2 completions. |

The application calculates the v2 course total by summing its modules. The legacy `cpe_hours` field is removed only after every reader and course has migrated.

#### `Modules`

| Field | Type | Rule |
|---|---|---|
| `cpe_value` | integer | Required for v2 modules; minimum `0`. |
| `type` | existing string | Compatibility-only; v2 course modules are content modules and do not use `quiz` or `essay` values. |

The existing course relation, title, order, Mux identifier, and preview fields remain. A unique database constraint covers `(course_id, order_index)`.

#### `Quizzes`

| Field | Type | Rule |
|---|---|---|
| `module_id` | relation to `Modules` | Required and unique. |
| `is_enabled` | boolean | Default `true`; disabling preserves configuration and attempt history. |
| `passing_score` | integer | Default `80`; range `0..100`. |

Quiz existence plus `is_enabled` is the configuration boundary. The application does not add a second `has_quiz` flag to `Modules` because two flags could disagree.

#### `Questions`

| Field | Type | Rule |
|---|---|---|
| `order_index` | integer | Required and unique within a quiz. |
| `explanation` | text | Returned only after the learner submits an answer. |

The existing question text, options, correct-answer index, and quiz relation remain.

#### `UserProgress`

Retain the collection name but sharpen its meaning to module progress.

| Field | Type | Rule |
|---|---|---|
| `user_id` | relation | Required. |
| `module_id` | relation | Required. |
| `content_completed_at` | timestamp, nullable | Set once after the server accepts the content-completion condition. |
| `quiz_passed_at` | timestamp, nullable | Set from a passing attempt when the enabled quiz exists. |
| `completed_at` | timestamp, nullable | Set when the module completion rule is satisfied. |
| `is_completed` | existing boolean | Compatibility projection of `completed_at != null`; removed after legacy readers migrate. |

A unique database constraint covers `(user_id, module_id)`. Progress timestamps are monotonic after course completion.

#### `Certificates`

| Field | Type | Rule |
|---|---|---|
| `completion_id` | relation to `CourseCompletions` | Required and unique. |
| `status` | string choice | `pending`, `processing`, `issued`, `delivered`, or `failed`. |
| `legal_name_snapshot` | string | Copied from the verified learner profile at completion. |
| `course_title_snapshot` | string | Copied at completion. |
| `cpe_earned` | integer | Copied from the completion. |
| `pdf_url` | existing string, nullable | Set after PDF storage succeeds. |
| `issued_date` | existing timestamp, nullable | Set when the certificate is issued. |
| `emailed_at` | timestamp, nullable | Set after the email provider accepts delivery. |
| `attempt_count` | integer | Incremented per workflow attempt. |
| `last_attempt_at` | timestamp, nullable | Operational evidence. |
| `failure_code` | string, nullable | Stable error category without secrets or learner data. |
| `failure_detail` | text, nullable | Administrator-only sanitized detail. |

The existing learner and course relations remain for dashboard and administrator queries.

### New collections

#### `QuizAttempts`

Quiz attempts replace destructive reset behavior.

| Field | Type | Rule |
|---|---|---|
| `id` | UUID | Primary key and client-visible attempt token. |
| `user_id` | relation | Required. |
| `quiz_id` | relation | Required. |
| `attempt_number` | integer | Unique within learner and quiz. |
| `status` | string choice | `in_progress`, `submitted`, or `abandoned`. |
| `answers` | JSON | Current selected answers for resume support. |
| `result_snapshot` | JSON, nullable | Immutable submitted question, selected-answer, and correct-answer evidence. |
| `score` | integer, nullable | Server-calculated percentage. |
| `passed` | boolean, nullable | Server-calculated result. |
| `started_at` | timestamp | Required. |
| `submitted_at` | timestamp, nullable | Set once. |

Unique constraints cover `(user_id, quiz_id, attempt_number)`. Only one `in_progress` attempt may exist per learner and quiz. A retake creates another attempt; it never deletes the previous result.

#### `CourseCompletions`

The existence of this record is the authoritative statement that the learner earned the course credit.

| Field | Type | Rule |
|---|---|---|
| `id` | UUID | Primary key. |
| `user_id` | relation | Required. |
| `course_id` | relation | Required. |
| `completed_at` | timestamp | Required and immutable. |
| `cpe_earned` | integer | Sum calculated on the server at completion. |
| `module_snapshot` | JSON | Ordered module IDs, titles, CPE values, completion times, and passing attempt IDs. |
| `final_quiz_attempt_id` | relation to `QuizAttempts` | Required. |

A unique database constraint covers `(user_id, course_id)`. The CPE and module snapshot never change after creation.

#### `FeedbackResponses`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID | Primary key. |
| `completion_id` | relation to `CourseCompletions` | Required and unique. |
| `user_id` | relation | Required and must match the completion. |
| `course_id` | relation | Required and must match the completion. |
| `knowledge_before` | integer | Required, `1..5`. |
| `knowledge_after` | integer | Required, `1..5`. |
| `relevance` | integer | Required, `1..5`. |
| `instructional_effectiveness` | integer | Required, `1..5`. |
| `intent_to_apply` | integer, nullable | `1..5`; null only when not applicable. |
| `intent_not_applicable` | boolean | Mutually exclusive with an intent rating. |
| `planned_application` | text, nullable | Maximum 2,000 characters. |
| `most_helpful` | text, nullable | Maximum 2,000 characters. |
| `improvement` | text, nullable | Maximum 2,000 characters. |
| `technical_issues` | JSON | Allowlisted categories. |
| `technical_issue_detail` | text, nullable | Maximum 1,000 characters. |
| `submitted_at` | timestamp | Server-generated. |

The separate learner and course relations are deliberate reporting indexes; the server verifies they match the completion rather than trusting submitted identifiers.

## 7. Application architecture

### Responsibility boundaries

| Component | Responsibility |
|---|---|
| Learner interface | Render content, quiz, completion notice, certificate status, and optional survey; send user intent but never decide eligibility or CPE. |
| Next.js server | Authenticate, authorize purchase access, score quizzes, advance module progress, decide course completion, calculate CPE, validate feedback, and expose administrator retry operations. |
| Directus | Persist configuration and business evidence, enforce unique constraints and permissions, and provide administrator content management. |
| n8n | Generate the certificate artifact, store it, send the email, and update certificate fulfillment status. |
| Observability interface | Read business feedback/completion records for reporting and activity logs for technical journey diagnostics. |

No client request may set `score`, `passed`, `completed_at`, `cpe_earned`, certificate status, or another learner's identifiers.

### Completion command flow

```text
Learner submits final quiz
        │
        ▼
Next.js authenticates learner and active purchase
        │
        ▼
Validate course/module/quiz relation and unlock state
        │
        ▼
Score answers and finalize immutable QuizAttempt
        │
        ├── failed ──> keep module incomplete; return retake state
        │
        ▼ passed
Advance UserProgress for the module
        │
        ▼
Re-read every ordered module and progress record
        │
        ├── any incomplete ──> return module completion and next module
        │
        ▼ all complete and current quiz belongs to final module
Create-or-read unique CourseCompletion with CPE/module snapshot
        │
        ▼
Create-or-read unique pending Certificate
        │
        ├── Directus create event ──> n8n certificate worker
        │
        ▼
Return completion, CPE, certificate status, and survey availability
```

Every step is retry-safe. Application-level existence checks improve error messages, but database unique constraints are the final concurrency control. On a uniqueness conflict, the server re-reads and returns the existing completion or certificate.

Directus REST calls across collections are not assumed to be one database transaction. A scheduled reconciliation operation repairs the only meaningful partial state: a valid course completion without a certificate record. It creates the missing pending certificate without altering the completion.

### Server contracts

The route names may follow the existing course/chapter layout, but their business contracts are:

1. **Complete module content:** Accepts course and module identity, verifies ownership/unlock state and the content completion signal, and sets `content_completed_at` once.
2. **Get or start quiz attempt:** Returns the enabled quiz, ordered questions without correct answers, and the learner's resumable in-progress attempt.
3. **Submit quiz answer:** Stores one selected answer and returns correctness plus explanation for that question.
4. **Submit quiz attempt:** Scores all answers on the server, finalizes the attempt, advances module/course completion, and returns the resulting state.
5. **Submit feedback:** Accepts only the answer payload; derives learner, course, and completion server-side and creates one response.
6. **Retry certificate:** Administrator-only; transitions a failed certificate to pending after clearing sanitized failure fields.

The existing arbitrary progress endpoint must no longer accept a client-provided completion boolean for v2 courses. It is replaced by intent-specific commands so callers cannot bypass quiz or course rules.

### Course reads and CPE totals

For v2 courses, catalog, course detail, dashboard, completion, and certificate reads use the sum of module `cpe_value`. The application must use one shared server-side total-calculation function rather than repeating aggregation rules.

The completion command recalculates the sum from Directus immediately before creating `CourseCompletions`; it never accepts a total from the browser or uses the compatibility course field.

## 8. Certificate workflow redesign

The existing n8n workflow is retained structurally but changes its trigger and source data:

1. Trigger on creation of a `Certificates` record with `status = pending`, not on an approved `Submissions` record.
2. Receive only the certificate ID as the work key.
3. Fetch the certificate and linked completion from Directus.
4. Exit successfully without side effects when status is already `issued` or `delivered`.
5. Change `pending` or retryable `failed` to `processing` and increment attempt metadata.
6. Generate the certificate from snapshot fields, including `legal_name_snapshot`, `course_title_snapshot`, and `cpe_earned`.
7. Store the PDF and update the same certificate record rather than creating another certificate record.
8. Send email with the certificate ID as the provider idempotency key when the provider supports it.
9. Mark the certificate `delivered` only after the provider accepts the message.
10. On error, store a sanitized failure category/detail and retry transient errors up to three times with increasing delay; leave exhausted failures in `failed`.

A scheduled reconciliation workflow checks for:

- Course completions without certificate records and creates the missing pending record.
- Certificates left in `processing` beyond the expected timeout and returns them to retryable failure.
- Pending certificates that did not receive a workflow run.

The certificate template must display the snapshot CPE value. Re-reading current module values during fulfillment is prohibited because course configuration may have changed after completion.

## 9. Survey and observability design

### Learner experience

After the completion response, the page displays:

1. Successful course completion.
2. Course title and CPE earned.
3. Current certificate status, with wording that generation may continue asynchronously.
4. The optional feedback survey with **Submit feedback** and **Close** actions.

Closing the survey dismisses it for the current interaction and records a telemetry event only. It does not create a business response or a declined status. Until a response exists, a **Provide feedback** action remains on the completed-course dashboard.

Submission success closes the survey and replaces the dashboard action with a non-editable thank-you state. Editing a submitted response is out of scope.

### Administrator reporting

The existing administrator observability page gains a **Course Feedback** tab. It reads `FeedbackResponses` and `CourseCompletions`, not only `UserActivityLogs`.

For the selected completion date range and optional course filter, it shows:

- Completions, responses, and response rate.
- Average before and after knowledge self-ratings and average change.
- Relevance, instructional-effectiveness, and intent-to-apply distributions.
- Technical issue counts by allowlisted category.
- A paginated response table with ratings, comments, learner, course, and submission time.

`Not applicable` intent responses are reported separately and excluded from the average intent rating. Response rate is `responses linked to completions in the selected range / completions in the selected range`; the numerator is not based solely on survey submission date.

### Telemetry events

The activity log may record journey events such as module content completed, quiz attempt submitted, course completed, survey shown, survey closed, survey submitted, and certificate status changed. These events support journey diagnostics but are never the source of truth for completion, certificates, or feedback values.

## 10. Authorization and data protection

1. Learner endpoints require an authenticated user and an active purchase for the course.
2. Every module and quiz command verifies the complete course-to-module-to-quiz relationship on the server.
3. Correct answers are never returned before the learner submits the corresponding answer.
4. Learners cannot read another learner's attempts, progress, completion, certificate, or feedback.
5. Survey writes go through the application server; public Directus roles receive no access to `FeedbackResponses`.
6. Only administrators may read survey comments, failure details, or all-course reporting.
7. The n8n service credential receives only the collection and file permissions required for certificate fulfillment.
8. Failure details and telemetry must not contain tokens, credentials, full quiz payloads, or unnecessary personal information.
9. Feedback text is rendered as plain text and length-limited; it is never injected as HTML.

## 11. Migration and coexistence

Migration is additive and course-scoped so legacy and v2 courses can coexist during rollout.

### Step 1: Add schema without changing behavior

Add new fields, collections, relations, indexes, and unique constraints. Existing courses receive `structure_version = legacy`. Deploy readers that tolerate both models before writing v2 records.

### Step 2: Produce a dry-run migration manifest

For each legacy course, report:

- Ordered video, quiz, and essay modules.
- Quiz-to-content-module mapping candidates.
- Existing course-level CPE and the required per-module allocation.
- Learner progress, quiz progress, approved submissions, and existing certificates.
- Ambiguities that require administrator input.

The migration stops for a course when a quiz cannot be mapped unambiguously or module CPE values have not been approved.

### Step 3: Map configuration

For the common legacy sequence, attach a standalone quiz's `Quizzes` record to the immediately preceding content module and remove the quiz entry from the v2 course order. Preserve the old module record until verification and mark it as migrated rather than deleting it during rollout.

Legacy essay modules and submissions remain as historical records but are excluded from v2 ordering and completion. Existing approved submissions and certificates are not modified or re-triggered.

Module CPE allocation is supplied explicitly in the manifest. The validator requires its sum to match the existing course CPE total before activation; it does not distribute credit automatically.

### Step 4: Map learner evidence

- Completed legacy video-module progress becomes `content_completed_at` on the mapped content module.
- A completed legacy quiz-module `UserProgress` record is the pass signal for the attached quiz; `QuizProgress.is_completed` alone is not treated as a pass because the current code sets it for failed submissions too.
- Existing quiz answers may be preserved as a migrated `QuizAttempts` snapshot, labeled with migration provenance.
- Existing certificates create corresponding immutable `CourseCompletions` and linked issued certificate data without invoking n8n.
- Learners in progress retain the furthest defensible content and passed-quiz evidence; ambiguous progress is reported rather than guessed.

### Step 5: Validate and activate per course

The activation validator confirms structure, module CPE total, final quiz, questions, passing threshold, progress mapping, and certificate reconciliation. Only then is `structure_version` changed to `module_quiz_v2`.

### Step 6: Retire legacy behavior

After every course is migrated and production reconciliation is clean, remove essay-gated certificate triggers, standalone quiz/essay rendering, compatibility progress writes, and the course-level CPE dependency. Physical deletion of historical records is a separate retention decision.

## 12. Delivery phases and review gates

This work should be phased rather than released as a single change.

### Phase 0 — Approve design and migration inputs

- The five open design decisions are accepted.
- Inventory production courses and populate the migration manifest.
- Confirm certificate template and email wording for module-summed CPE.

**Gate:** Every existing course has an owner-approved module and CPE mapping or is explicitly deferred.

### Phase 1 — Directus foundation

- Add schema, relations, indexes, permissions, and validation tooling.
- Add dual-model TypeScript contracts.
- Implement dry-run and reconciliation reports.

**Gate:** Schema migration is repeatable; invalid and ambiguous course structures fail without modifying data.

### Phase 2 — Completion domain service

- Implement quiz attempts, module-completion rules, shared CPE calculation, course-completion creation, and certificate work-item creation.
- Replace arbitrary v2 progress writes with intent-specific server commands.

**Gate:** Integration tests prove authorization, failed-quiz behavior, prerequisite enforcement, immutable attempts, and concurrency-safe single completion.

### Phase 3 — Learner journey

- Render the quiz at the end of module content.
- Update module locking, resume behavior, progress totals, course completion notice, dashboard totals, and certificate status.

**Gate:** One-module and multi-module end-to-end scenarios pass with and without intermediate quizzes.

### Phase 4 — Certificate fulfillment

- Change the n8n trigger and payload.
- Update certificate template data, status transitions, retries, reconciliation, and administrator retry.

**Gate:** Replayed and concurrent triggers produce one certificate record and one accepted certificate email; simulated provider failure remains retryable without revoking completion.

### Phase 5 — Feedback and observability

- Add the survey API and accessible interface.
- Add feedback aggregates, filters, response table, and certificate failure visibility.

**Gate:** Close and submit paths behave independently of certification; unauthorized access and duplicate/invalid submissions fail.

### Phase 6 — Course migration and cleanup

- Migrate and activate courses one at a time.
- Reconcile learner evidence and existing certificates.
- Observe the first production completions before retiring legacy paths.
- Update the HLD, quiz requirements, schema/setup guidance, n8n documentation, and operational runbook after verification.

**Gate:** Production counts reconcile, no certificate is reissued, and no learner loses defensible progress.

## 13. Verification strategy

### Automated tests

1. **Domain unit tests:** CPE sum, module completion with/without quiz, final-module detection, course eligibility, and survey aggregates.
2. **API integration tests:** Authentication, purchase authorization, cross-course identifier rejection, scoring, retakes, duplicate submissions, and input limits.
3. **Concurrency tests:** Two final-quiz submissions yield one completion and one certificate work item.
4. **Migration tests:** Dry-run fixtures cover ordinary mapping, ambiguous quizzes, missing CPE, in-progress learners, passed legacy quizzes, and already-issued certificates.
5. **Workflow contract tests:** Duplicate certificate events, provider timeout, retry exhaustion, replay after issuance, and reconciliation of missing/stuck work.
6. **Permission tests:** Public and learner roles cannot read feedback, correct answers, other learners' evidence, or certificate failure details.

### End-to-end scenarios

Use the nine acceptance scenarios in the requirements as the minimum suite, with these additions:

- A quiz cannot start before its module content is complete.
- A later module cannot open before the preceding module is complete.
- Correct answers are unavailable before answer submission.
- Closing feedback allows later reopening from the dashboard.
- Editing module CPE after completion does not alter completion or certificate snapshots.
- An existing issued certificate is not reissued during migration.

### Pass when

1. Course totals equal the module sum in every learner-visible location.
2. Server-side evidence, not client state, determines module and course completion.
3. Failed quizzes and incomplete prerequisites cannot produce a completion.
4. Repeated or concurrent completion requests converge on one completion, certificate, and email delivery.
5. Certificate failures are visible and retryable while completion remains intact.
6. Survey dismissal has no business side effect, and one valid response appears in administrator reporting.
7. Migration reconciliation accounts for all existing progress, submissions, completions, and certificates without silent guessing.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Existing quiz ownership is ambiguous. | Dry-run manifest, per-course approval, and fail-closed activation. |
| Existing course CPE cannot be safely divided among modules. | Require explicit module allocation whose sum matches the existing total. |
| Directus multi-collection writes partially succeed. | Idempotent create-or-read operations, unique constraints, and scheduled reconciliation. |
| Duplicate n8n invocations create duplicate side effects. | One certificate work item, terminal-state checks, stable provider idempotency key, and replay tests. |
| Quiz questions change after an attempt. | Store immutable submitted result evidence and completion module snapshots. |
| Business reporting is mixed with telemetry. | Treat completion and feedback collections as authoritative; use activity logs only for journey diagnostics. |
| Legacy and v2 behavior diverge during rollout. | Course-scoped `structure_version`, dual-model tests, and time-bounded coexistence. |

## 15. Approval checklist

- [x] Approve integer module CPE validation.
- [x] Approve final-module quiz as mandatory for certificate-awarding courses.
- [x] Approve removal of the essay/manual-grade certificate gate.
- [x] Approve identified, administrator-only feedback and dashboard reopening.
- [x] Approve n8n retry and administrator recovery ownership.
- [x] Approve per-course migration with explicit CPE allocation.
- [ ] Approve phased delivery and course-scoped activation.

Implementation may begin with Phase 1 only after this checklist and the Phase 0 migration inputs are approved.
