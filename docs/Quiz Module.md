# Module Quiz Requirements

## Purpose

A module quiz is an optional knowledge check attached to the end of one content module. It is not a standalone course module. A certificate-awarding course must have an enabled quiz on its final module.

## Learner behavior

- A learner must complete the module content before starting its quiz.
- A later module remains locked until the preceding module and any enabled quiz are complete.
- Questions are presented in configured order, one at a time, with exactly one correct answer.
- Correctness and the explanation are revealed only after the learner submits that question's answer.
- The server stores an in-progress attempt so the learner can resume across sessions.
- The server calculates the score and pass result; the browser cannot submit either value.
- A failed attempt remains immutable and does not complete the module, unlock later content, or create a certificate.
- A retake creates a new attempt and never erases earlier answers or results.
- Passing the enabled quiz completes the module after its content requirement is satisfied.

The configured passing score is an integer from 0 through 100. An enabled quiz has at least one ordered question.

## Persistence

- `Quizzes.module_id` uniquely identifies the owning module; `is_enabled` controls whether the quiz affects completion.
- `Questions.order_index` is unique within a quiz, and `explanation` is protected until answer submission.
- `QuizAttempts` stores resumable answers and immutable submitted result evidence.
- `UserProgress.content_completed_at`, `quiz_passed_at`, and `completed_at` are monotonic business evidence.
- `CourseCompletions` is the one-time course award and references the final passing attempt.

`QuizProgress`, standalone `quiz` and `essay` module types, and `Submissions` remain compatibility-only while legacy courses coexist. They must not be used by `module_quiz_v2` courses and are retired only after `cleanup-check` passes.

## Test

1. Attempt to start a quiz before completing content and confirm the server rejects it.
2. Submit one answer and confirm only that question's correctness and explanation are returned.
3. Submit a failing attempt and confirm it remains stored, the module remains incomplete, and a retake receives a new attempt number.
4. Pass the final-module quiz twice or concurrently and confirm one completion and one certificate work item exist.

## Pass when

The server owns scoring and completion, failed evidence is retained, prerequisites cannot be bypassed, and retries converge without duplicate awards or certificates.
