# **Quiz and Assessment Module Requirements**

## **1. General Overview**
The Quiz and Assessment Module is a core component of the CPE training platform that allows students to complete learning checks and write observative essays. The overall visual design and interaction patterns must align seamlessly with the existing LMS frontend.

---

## **2. Architecture & Module Types**
Courses are built using three distinct types of modules, managed via the `type` field in the `Modules` collection:
1. **`video`:** Standard module containing Mux video streaming and playback.
2. **`quiz`:** Multiple-choice questionnaire assessing module understanding.
3. **`essay`:** Open-ended essay response serving as the Final Assessment.

---

## **3. Quiz Functionality**
Quizzes are associated with specific course modules and support the following features:
* **Multiple-Choice Structure:** Questions feature 4 options with exactly 1 correct answer.
* **Predetermined Sequence:** Quizzes support up to 15 questions, presented in a set order configured by the instructor.
* **Single-Question View:** Students view and answer one question at a time.
* **Real-Time Feedback:** Submitting an answer instantly displays feedback (Green for Correct, Red for Incorrect) alongside a detailed text explanation loaded from the question's `explanation` field.
* **Navigation Locking:** The quiz is listed in the course navigation bar and only unlocks when all preceding video modules are completed.
* **Backend State Persistence:** Student answers are persisted to the database on each submission (stored in a `QuizProgress` collection) allowing users to safely exit and resume their attempt across devices.
* **Passing Threshold (80%):** Students must score at least 80% correct to pass. Passing the quiz is a strict gate required to unlock the subsequent Final Assessment (Essay) module. Failing requires the student to retake the quiz.

---

## **4. Final Assessment (Essay) Functionality**
The final step before certificate generation is a reflective open-ended writing prompt:
* **Prerequisites:** Only unlocks and becomes clickable in the course navigation after all video modules are complete AND the course quiz is passed (>= 80% score).
* **Essay Input:** Features a text area with no character limit.
* **Backend Draft Recovery:** Progress is automatically saved to the `Submissions` collection in Directus as a `Draft` status, ensuring students can resume writing later.
* **Final Submission:** Clicking "Submit Assessment" displays a confirmation modal. Once confirmed, the submission status is set to `Pending`, lockouts are enabled, and the user is informed that an instructor will grade the essay within 3 days.

---

## **5. Directus Schema Additions**
To support this phase, the following database updates are required:
* **`Modules` collection:** Add a `type` dropdown field (`video`, `quiz`, `essay`) with a default value of `video`.
* **`Questions` collection:** Add an `explanation` text area field.
* **`QuizProgress` collection (NEW):**
  * `id` (UUID, Primary Key)
  * `user_id` (UUID, linked to `directus_users`)
  * `module_id` (UUID, linked to `Modules`)
  * `answers` (JSON, storing active answers key-value map, e.g., `{"question_id": selected_index}`)
  * `is_completed` (Boolean)
* **`Submissions` collection modifications:**
  * Update `status` field choices to: `['Draft', 'Pending', 'Approved', 'Rejected']`.

---

## **6. Non-MVP Requirements**
1. Support checkboxes for multiple-choice questions with more than one correct answer.
2. Enable instructors to reset a submission status back to `Draft` to let a student retake their essay.