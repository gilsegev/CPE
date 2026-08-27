# CPE B2C Product Requirements

## 1. Purpose and scope

Guiding Diversity's existing marketing site is [https://www.guidingdiversity.com/](https://www.guidingdiversity.com/). The B2C CPE application enables an individual teacher to register, buy a self-paced course, complete its learning modules and knowledge checks, receive a CPE certificate, and optionally provide course feedback.

The Squarespace site remains the marketing layer and links into the application. The application may be hosted separately, but the transition must feel like part of the same Guiding Diversity experience.

This document covers the direct-to-teacher B2C model. District-funded B2B delivery is out of scope.

## 2. Business terms

- **Course:** A purchased learning experience composed of one or more ordered modules.
- **Module:** A unit of learning content with its own CPE credit value and, optionally, one quiz at its end.
- **Module quiz:** A configurable multiple-choice knowledge check attached to a module; it is not a standalone course module.
- **Module completion:** Completion of the module content and, when the module has a quiz, a passing quiz result.
- **Course completion:** Completion of every module in the course, including all configured module quizzes.
- **CPE earned:** The sum of the CPE values of all modules in the completed course.
- **Feedback survey:** An optional post-course evaluation shown after successful course completion; it never gates completion or certificate generation.

## 3. Functional requirements

### 3.1 Registration, authentication, and access

1. Registration must explicitly request the teacher's **Legal Name for Certificate** rather than relying on a username or identity-provider display name.
2. A teacher must be able to sign in, sign out, and resume a purchased course from their saved state on another session or device.
3. Authentication data, purchases, module progress, quiz attempts, course completions, certificates, and survey responses must persist over time.
4. A teacher may revisit the content of a completed purchased course without generating another completion or duplicate certificate.

### 3.2 Course and module structure

1. A course must contain at least one published module and may contain any greater number of ordered modules.
2. Each module must have a configurable, non-negative integer CPE value.
3. Module CPE is the source of truth for the course's CPE total. For example, five modules worth 1 CPE each produce a 5-CPE course certificate.
4. The learner-facing course total must equal the sum of its module values everywhere it is displayed, including the catalog, course detail, learner dashboard, completion message, and certificate.
5. The CPE total awarded at completion must be stored with the completion/certificate so later edits to module values do not alter an already-issued certificate.
6. Modules unlock in configured order. A later module remains locked until the preceding module is complete.
7. The learner's content and quiz progress must be saved so they can leave and resume without losing completed work.

### 3.3 Configurable module quizzes

1. An administrator must be able to enable or disable a quiz independently for each module.
2. A module may have zero or one quiz. When enabled, completing the module content reveals a **Continue to Quiz** action; the quiz opens as the next, separate course-player step rather than inline beneath the content or as a standalone item in the course sequence.
3. An administrator must be able to configure the quiz's ordered questions, answer options, correct answer, answer explanation, and passing score. The default passing score is 80%.
4. Questions use a question-and-answer interaction: after an answer is submitted, the learner is told whether it is correct and is shown the configured explanation.
5. Quiz answers and attempt state must persist in Directus so the learner can safely leave and resume.
6. A module with a quiz is not complete until its content is complete and the quiz is passed.
7. A failed quiz does not complete the module, unlock the next module, complete the course, or trigger a certificate. The learner may retake it.
8. A module without a quiz is complete when its configured content-completion condition is met.
9. A certificate-awarding course must have a quiz on its final module. Earlier modules may have quizzes but are not required to have them.

### 3.4 Course completion and certificate workflow

1. When the learner passes the final module's quiz, the server must verify that every module in the course is complete before recording course completion.
2. The first successful transition to course completion must perform the following outcomes without requiring manual grading:
   - Persist the course completion and the CPE total earned.
   - Start the certificate-generation workflow.
   - Show the learner an immediate successful-completion message that includes the course name and CPE earned.
   - Present the optional feedback survey.
3. The certificate-generation workflow must use the teacher's verified legal name and the stored CPE total, generate the PDF certificate, make it available from the learner dashboard, and send it through the configured certificate-delivery channel.
4. Completion processing and certificate generation must be idempotent: refreshes, retries, repeated requests, or duplicate quiz submissions must not create duplicate completions, certificates, or certificate emails.
5. A transient certificate-generation failure must not reverse the learner's course completion. The failure must be observable and retryable.
6. Closing or submitting the feedback survey must not delay, cancel, or repeat certificate generation.

The previous flow of `watch -> course quiz -> submit case study -> manual grade -> certificate` is superseded for this requirement. A manually graded case study may be introduced later as a separate feature, but it is not part of the current course-completion or certificate path.

### 3.5 Post-course feedback survey

The survey is intentionally brief and focuses on learning effectiveness and transfer to classroom practice. Objective knowledge is measured by module quizzes; the survey must not present self-reported learning as an objective score.

The completion experience must let the learner either submit the survey or close it. Closing is a valid choice and leaves the course complete and certificate workflow unchanged.

When submitted, the survey contains the following questions:

| # | Question | Response | Required on submit |
|---|---|---|---|
| 1 | Before this course, how knowledgeable or skilled were you in the course topic? | 1-5: Not at all to Extremely | Yes |
| 2 | After this course, how knowledgeable or skilled are you in the course topic? | 1-5: Not at all to Extremely | Yes |
| 3 | How relevant is this course to your current work as an educator? | 1-5: Not at all to Extremely | Yes |
| 4 | The course content, examples, and activities helped me learn. | 1-5: Strongly disagree to Strongly agree | Yes |
| 5 | How likely are you to use what you learned in your work? | 1-5: Definitely not to Definitely will, plus Not applicable | Yes |
| 6 | What, if anything, do you plan to use from this course? | Free text | No |
| 7 | What part of the course was most helpful to your learning? | Free text | No |
| 8 | How could this course be improved? | Free text | No |
| 9 | Did you experience a technical problem? | No, or select all: video, quiz, navigation, certificate, other with details | No |

Survey requirements:

1. The form must state that feedback is optional and does not affect CPE credit or certificate issuance.
2. A learner may submit at most one response per course completion.
3. A submitted response must be persisted in Directus with the learner, course, completion/certificate context, answer values, and submission timestamp.
4. Server-side validation must reject missing required answers, values outside configured ranges, invalid course/user relationships, and duplicate submissions.
5. Survey text fields must be safely handled as untrusted user input and must have reasonable configurable length limits.

#### Survey basis

The question set is adapted from established post-training evaluation patterns:

- The [CDC Recommended Training Effectiveness Questions](https://www.cdc.gov/training-development/media/pdfs/2024/04/Recommended-Training-Effectiveness-Questions-for-Postcourse-Evaluations.pdf) recommends retrospective before/after knowledge, relevance, intent to apply, strengths, and improvement questions for adult professional learning.
- The [CDC TRAIN post-course guide](https://courses.cdc.train.org/Resources/Post-Course_and_Follow-Up_Evaluations_(CDCTRAINOMBApproved)_User_Guide_2022-508.pdf) adds questions about instructional strategies, professional-practice needs, expectations, and technical challenges.
- The [UC Berkeley course-evaluation question bank](https://teaching.berkeley.edu/resources/course-evaluations-question-bank) emphasizes application to practice and deeper insight rather than relying only on overall satisfaction.
- The [University of Plymouth CPD evaluation toolkit](https://www.plymouth.ac.uk/research/pedagogic-research/satisfaction-questions) distinguishes immediate participant reaction from actual impact on teaching practice; therefore, this survey pairs learner feedback with objective quiz results and does not claim to measure long-term classroom impact.

### 3.6 Directus administration and observability

1. An administrator must be able to create, order, publish, and edit courses and modules; set module CPE values; and enable and configure each module's quiz in Directus.
2. Directus must persist survey responses as reportable records, not only as free-form observability-event metadata.
3. The existing administrator-only observability view must include a **Course Feedback** view with:
   - Response count and response rate by course and date range.
   - Average before/after self-rating and the average change.
   - Relevance, instructional-effectiveness, and intent-to-apply distributions.
   - Technical-problem counts by category.
   - A response table containing submitted ratings and optional comments.
4. Administrators must be able to filter feedback results by course and submission date.
5. Survey results and learner identity must remain restricted to authorized administrators and must not be exposed through public Directus permissions or public application endpoints.
6. Certificate workflow status and failures must be visible to administrators so failed processing can be identified and retried.

### 3.7 Billing and receipts

1. Teachers must be able to pay directly for course access using the configured payment provider, currently Square.
2. Successful checkout must grant access to the purchased course and send a detailed, itemized receipt.
3. If supported by the payment integration, the learner dashboard should provide a **Download Invoice** action without requiring manual administrator fulfillment.
4. Payment history must remain associated with the authenticated learner.

## 4. Non-functional requirements

1. **Capacity:** Support 1-5 concurrent learners without degradation that blocks course completion.
2. **Security:** Securely persist personal information, authentication data, purchases, progress, quiz results, certificates, and survey responses. Payment-card data must remain with the payment provider rather than being stored by the application.
3. **Authorization:** Server-side checks must protect purchased content, progress updates, quiz submission, certificate access, survey submission, and administrator reporting.
4. **Auditability:** The system must retain the evidence needed to explain why a certificate was issued: learner, course, completed modules, quiz outcomes, CPE awarded, completion time, and certificate status.
5. **Reliability:** Course completion must remain correct under refreshes, network retries, simultaneous submissions, and temporary failure of the external certificate workflow.
6. **Accessibility:** Course completion, quiz feedback, completion notification, and survey controls must be keyboard accessible and understandable without relying only on color.
7. **Brand continuity:** The separately hosted application must use Guiding Diversity branding and navigation cues so the handoff from Squarespace feels cohesive.

## 5. Acceptance scenarios

1. **One-module course:** Given a purchased course with one 2-CPE module and a final quiz, when the learner completes the content and passes the quiz, the course completes once and one 2-CPE certificate workflow starts.
2. **Multi-module total:** Given five ordered 1-CPE modules, when the learner completes all five and passes all configured quizzes, the completion and certificate record 5 CPE.
3. **Optional intermediate quiz:** Given an earlier module without a quiz, completing its content unlocks the next module; given an earlier module with a quiz, the next module stays locked until that quiz is passed.
4. **Failed quiz:** When the learner fails any module quiz, that module remains incomplete and no later module or certificate is unlocked.
5. **Incomplete prerequisites:** Passing the final module quiz through a direct or repeated API request does not complete the course if any earlier module is incomplete.
6. **Duplicate completion:** Repeating the successful final-quiz request produces one course completion, one certificate, and one certificate delivery.
7. **Survey close:** Closing the survey leaves the course complete and the certificate workflow running; no survey response is created.
8. **Survey submit:** A valid survey submission creates one Directus response visible in Course Feedback; a duplicate or invalid response is rejected without affecting completion.
9. **Certificate failure:** If certificate generation temporarily fails, the course remains complete, the failure is visible to an administrator, and a retry does not create a duplicate certificate.

## 6. Decisions and open questions

The following decisions are established by this revision:

1. Module CPE values, rather than a manually maintained course-level total, determine the certificate value.
2. Module CPE values are stored and awarded as whole-number integers.
3. A module quiz is attached to module content; quiz and essay are no longer separate module types in the target course model.
4. Earlier module quizzes are optional, but the final module quiz is required for a certificate-awarding course.
5. The case-study/manual-approval gate is removed from the current certificate workflow.
6. Feedback is optional and is not a certificate gate.
7. A dismissed survey remains available from the completed-course dashboard until submitted.
8. Feedback is linked to the learner and course and is visible only to authorized administrators.
9. Certificate processing uses automatic n8n retries followed by administrator-controlled retry for exhausted failures.

The following questions should be resolved in the technical design before implementation:

1. What are the approved per-module CPE allocations for each existing course?
2. How should any ambiguous standalone quiz or essay modules be mapped during migration?

## 7. Deferred requirements

1. Google OAuth registration, while still collecting a required legal name and optional TEA ID.
2. Multi-select quiz questions with more than one correct answer.
3. Follow-up surveys sent after the learner has had time to apply the material in classroom practice.
4. A manually graded case study or essay, unless it is separately prioritized with clear rules for whether it gates CPE credit.
