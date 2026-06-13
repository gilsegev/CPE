# **CPE Training Platform \- High-Level Design (v2)**

This document outlines the systematic architecture, data schema, and implementation strategy for the Next.js and Directus-based Continuing Professional Education (CPE) platform.

## **1\. Executive Summary & Core User Journey**

The platform delivers compliant, certified training modules. The critical path for a user is:

1. **Authentication & Purchase:** Register/login and purchase course access via Stripe.  
2. **Consumption:** Watch adaptive bitrate videos (via Mux).  
3. **Assessment:** Complete a structured multiple-choice quiz and submit a text-based case study (essay).  
4. **Evaluation:** Admin (Instructor) manually reviews the case study in the backend dashboard and marks it as Approved.  
5. **Certification:** An automated pipeline generates a customized PDF certificate and emails it to the user.

## **2\. Technology Stack & Roles**

| Component | Technology | Primary Responsibilities |
| :---- | :---- | :---- |
| **Frontend UI/UX** | Next.js, React, Tailwind CSS | User-facing LMS (modified Antonio Erdeljac clone). Manages client routing, local state, video playback UI, and custom quiz rendering. |
| **Backend API & CMS** | Directus | Headless CMS, Auth (JWT via Directus SDK), RBAC, REST/GraphQL API generation, and Admin Dashboard for course/user management. |
| **Database** | PostgreSQL (Managed) | Relational storage for the core data schema. Managed via Supabase, Neon, or DigitalOcean. |
| **Video Hosting** | Mux | Adaptive bitrate streaming, video hosting, and playback state tracking (pause/resume). Offloads media handling from the DB. |
| **Payments** | Stripe | Secure checkout, payment intents, and automated tax receipts. |
| **Automation Pipeline** | n8n | Asynchronous orchestration for certificate generation and email triggers. |
| **Transactional Email** | Resend / SendGrid | Delivery of welcome emails, password resets, and final certificates. |

## **3\. Core Data Schema (Directus Models)**

This explicit schema replaces the default Prisma models from the clone, mapping directly to Directus collections.

| Collection | Fields & Types | Relationships / Notes |
| :---- | :---- | :---- |
| **Users** (System) | id, email, password, first\_name, last\_name, tea\_provider\_number, role | Extended Directus Directus\_Users table. |
| **Courses** | id, title, description, price, is\_published, thumbnail\_url | Parent container for training content. |
| **Modules** | id, course\_id, title, order\_index, mux\_asset\_id, is\_free\_preview | Many-to-One with Courses. |
| **Purchases** | id, user\_id, course\_id, stripe\_payment\_id, status | Junction table tracking access control. |
| **Quizzes** | id, module\_id, passing\_score | One-to-One with Modules. Custom build. |
| **Questions** | id, quiz\_id, question\_text, options (JSON), correct\_answer\_index | Many-to-One with Quizzes. Options stored as JSON array. |
| **Submissions** | id, user\_id, course\_id, quiz\_score, essay\_text, status (Pending, Approved, Rejected) | The master log for compliance and grading. |
| **Certificates** | id, user\_id, course\_id, pdf\_url, issued\_date | Generated asynchronously by n8n. |

## **4\. System Workflows & Integrations**

### **4.1 Authentication & Database Access**

* **Action:** Remove Clerk Auth and Prisma ORM from the Next.js clone.  
* **Implementation:** Integrate the `@directus/sdk` in Next.js. Authentication handles sessions via Directus JWTs. All Next.js data fetching (e.g., loading course lists) is executed via REST/GraphQL queries to the Directus endpoints using the authenticated user's token, ensuring Role-Based Access Control (RBAC) is respected.
* **Public Guest Access:** To optimize B2C conversions, users can browse the course catalog (`/search`) and view course details/free previews (`/courses/[courseId]`) anonymously. The system queries public-published items directly from Directus without a session. Authentication is deferred and only enforced when the user attempts to enroll in a course (Stripe checkout) or track module progress.

[not completed yet]### **4.2 Payment & Access Provisioning (Stripe)**

* **Checkout:** Next.js requests a Stripe Checkout Session via a Directus custom endpoint or serverless function.  
* **Webhook:** Upon successful payment, Stripe fires a webhook to Directus.  
* **Provisioning:** Directus creates a record in the **Purchases** table, unlocking the course for the User ID.

### **4.3 The Custom Assessment Engine**

* **Frontend:** Since the clone lacks quizzes, build a custom React component that fetches the **Questions** payload from Directus. It manages active attempt state and submits the final user answers. The FE must look and feel as an integral part of the overall application (i.e. use common elements and components to make the experience seamless)   
* **Validation:** Directus receives the submission, calculates the score server-side to prevent cheating, and requires the text input for the Case Study. The record is saved in **Submissions** with a "Pending" status.

### **4.4 Certificate & Automation Pipeline (n8n)**

* **Trigger:** Admin reviews the Case Study in the Directus Dashboard and changes the Submission status to "Approved".  
* **Webhook:** Directus fires a native webhook to an n8n endpoint containing the user\_id and course\_id.  
* **Processing:** n8n queries Directus for the user's Full Name and TEA Provider Number. It maps these variables into a pre-formatted Google Docs template.  
* **Generation:** n8n exports the Google Doc as a PDF.  
* **Delivery:** n8n triggers the Email API (Resend) to email the PDF to the user and writes the PDF URL back to the **Certificates** table in Directus for future access.

### **4.5 Video Progress Guard (Seeking Restrictions)**

* **Compliance Requirement:** To satisfy TEA certification standards, students must watch video modules in their entirety.
* **Implementation:** The Next.js video component intercepts seek events via the Mux Player `onTimeUpdate` and `onSeeking` event streams.
* **Behavior:** The player tracks the furthest watched timestamp. If a student attempts to seek forward beyond this point, the video snaps back to the furthest watched time and triggers a warning toast. Backward seeking is fully enabled to permit review.

## **5\. Implementation Phases**

1. **Phase 1: Infrastructure & Backend Foundation**  
   * Provision managed PostgreSQL DB and Directus instance (e.g., Railway/DigitalOcean).  
   * Define all Data Schema collections and relationships inside Directus.  
   * Configure Directus Roles and Permissions (Public, Student, Admin).  
2. **Phase 2: Frontend Surgery**  
   * Clone the Antonio Next.js repo.  
   * Strip out Prisma and Clerk.  
   * Wire up the @directus/sdk for authentication and fetch dynamic course data.  
3. **Phase 3: Video **  
   * Connect Mux for module video playback.  
   * Implement forward-seek prevention logic in the video player to ensure course completion compliance.
4. **Phase 4: Custom Assessment Engineering**  
   * Integrate with email service - send highly detailed and itemized invoice/receipt emails for payments.  
   * Build the Frontend Quiz & Essay submission UI.  
   * Implement the submission logic and Directus storage.  
5. **Phase 5: Google Registration, Account Deletion & Automation Pipeline**  
   * Implement server-side Google OAuth authentication and auto-registration for Students.
   * Add `/confirm-profile` gating to enforce official Legal Name confirmation.
   * Implement destructive "Delete user" cascading DB cleanup next to "Clean user".
   * Deploy n8n.  
   * Design the Google Doc Certificate template.  
   * Build the Webhook \-> n8n \-> Google Doc \-> PDF \-> Email flow.
   * Remove "Clean user" button (in production environment).
6. **Phase 6: Payments**
   * Integrate Stripe Checkout and setup the webhook listener in Directus.  

## **6. Phase Verification & Exit Gates**

### **Phase 2 Exit Gate: Frontend Surgery**
* **Build Check:** Next.js application compiles cleanly using `npm run build` with zero TypeScript or webpack errors.
* **Authentication:** Custom `/sign-in` and `/sign-up` forms successfully verify, create, and log in Directus users. Legal Name (required) and TEA ID (optional) are persisted.
* **Session Management:** Secure HTTP-only cookies (`directus_access_token` and `directus_refresh_token`) protect personalized student portals (e.g., `/` home dashboard and checkout/progress api routes), while catalog search and preview chapters are publicly accessible.
* **Data Retrieval:** Action helpers successfully load dynamic course and chapter lists directly from the Directus REST API.

### **Phase 3 Exit Gate: Video & Payments**

* **Webhook Provisioning:** Stripe's success callback fires to `/api/webhook`, which uses the Directus SDK to provision an active course purchase.
* **Mux Video Playback:** Module video components retrieve and stream Mux playback IDs. Free previews play immediately; locked modules require active purchase validation.
* **Video Seeking Restriction:** Video component intercepts seeking forward past the furthest watched point and snaps the playback position back to safeguard compliance.

### **Phase 4 Exit Gate: Custom Assessment Engineering**

A rigorous, step-by-step verification plan is required to validate Phase 4 without browser E2E test suites (using developer checks, terminal queries, and component testing instead):

#### **Test Setup & Database Seeding**
1. Run the custom seed script to insert:
   - 1 Quiz module with 5 ADHD-related multiple-choice questions (options, correct answer index, and text explanation for each).
   - 1 Essay module at the end of the course.
2. Ensure you have a test user registered (e.g. `gil.segev1@gmail.com`) and enrolled in the course.

#### **1. Access Gating & Sequencing Verification**
* **Step 1.1: Initial Locks Check**
  - Log in as the student and navigate to the course.
  - Verify that both the **Quiz** and **Essay** modules are marked as locked (rendered with a lock icon) in the sidebar.
  - Try accessing `/courses/[courseId]/chapters/[quizModuleId]` directly via URL. Verify that the server redirects you or displays a premium "locked" screen preventing access.
* **Step 1.2: Partial Completion Check**
  - Watch or mark complete some, but not all, video modules.
  - Verify that the Quiz remains locked in the sidebar and Chapter details view.
* **Step 1.3: Quiz Unlocking**
  - Mark all preceding video modules completed.
  - Verify that the Quiz module in the sidebar immediately updates:
    - Lock icon is replaced with the `HelpCircle` quiz icon.
    - Clicking the Quiz in the sidebar now successfully opens the quiz layout.
    - The **Essay** module remains locked with a lock icon.

#### **2. Single-Question Quiz Interaction & Feedback Verification**
* **Step 2.1: Single-Question Layout**
  - On the Quiz page, verify that only the first question is rendered.
  - Verify that progress text (e.g., "Question 1 of 5") matches the seeded questions.
  - Verify the "Submit Answer" button is enabled only after selecting an option.
* **Step 2.2: Real-time Inline Feedback**
  - Select the correct answer and click "Submit Answer".
  - Verify that:
    - The options are locked (disabled).
    - The correct option is highlighted with a green border/background.
    - The detailed explanation text is rendered underneath the question.
  - Click "Next" to go to Question 2.
  - Select an incorrect answer and click "Submit Answer".
  - Verify that:
    - The options are locked.
    - The incorrect selection is highlighted in red.
    - The correct answer is highlighted in green.
    - The explanation text is rendered.
* **Step 2.3: Backward Navigation**
  - On Question 3, click the "Previous" button.
  - Verify that the UI displays Question 2 in a read-only state, preserving your submitted selection, the correct/incorrect styling, and explanation.

#### **3. State Recovery & Persistence Verification**
* **Step 3.1: Quiz State Persistence**
  - Submit answers for Questions 1 and 2.
  - Refresh the page, or navigate to a different route and return to the Quiz page.
  - Verify that the quiz recovers at **Question 3**.
  - Click "Previous" to verify that your answers to Questions 1 and 2 are fully recovered and styled correctly.
  - Run a database check script or query Directus `QuizProgress` table:
    - Verify that the `answers` JSON field contains a map of the submitted question IDs to their selected option indexes.
    - Verify that `is_completed` is `false`.

#### **4. Passing Threshold & Retake Verification**
* **Step 4.1: Quiz Fail Path (< 80%)**
  - Complete the remaining questions so that the total score is less than 80% (e.g. 3 out of 5 correct is 60%).
  - Click the final "Submit Quiz" button.
  - Verify that:
    - A "Fail" screen is displayed indicating your score of 60%.
    - A "Retake Quiz" button is rendered.
    - The **Essay** module in the sidebar remains locked.
  - Refresh the page and verify that the "Fail" screen remains active (read-only persistence).
* **Step 4.2: Quiz Reset / Retake**
  - Click the "Retake Quiz" button.
  - Verify that:
    - The quiz starts over at Question 1.
    - Option inputs are unlocked and selectables are reset.
    - Directus check: verify `QuizProgress` record for this user/module has its `answers` JSON reset to `{}` and `is_completed` is `false`.
* **Step 4.3: Quiz Pass Path (>= 80%)**
  - Complete the quiz selecting at least 4 out of 5 correct answers (80% or 100%).
  - Click the final "Submit Quiz" button.
  - Verify that:
    - A success confetti animation is triggered.
    - A "Pass" screen is displayed showing your passing score.
    - The Essay module in the sidebar immediately unlocks (displays `FileText` icon, is clickable).
    - Directus check: verify `UserProgress` has a completed record for the Quiz module (`is_completed: true`).

#### **5. Essay Draft Saving & Submission Lifecycle Verification**
* **Step 5.1: Essay Draft Recovery**
  - Navigate to the newly unlocked Essay chapter.
  - Type a partial sentence (e.g. "This is my initial draft...").
  - Wait 2 seconds and observe the "Draft saved" status indicator.
  - Navigate to the course dashboard and then back to the Essay chapter.
  - Verify that the text "This is my initial draft..." is recovered in the editor.
  - Query Directus `Submissions` table: verify a record exists for this user/course with `status: "Draft"` and `essay_text: "This is my initial draft..."`.
* **Step 5.2: Submission Confirmation Modal**
  - Click "Submit Assessment".
  - Verify that a confirmation modal is displayed asking if you are sure you want to submit.
  - Click "Cancel". Verify you can still edit the text area.
* **Step 5.3: Submission Status Change**
  - Click "Submit Assessment" again and click "Confirm".
  - Verify that:
    - The text area becomes read-only (disabled).
    - The "Submit" button is replaced with a banner showing: "Status: Pending Review - An instructor will grade your essay within 3 days."
    - Directus check: verify the `Submissions` record status is updated to `"Pending"`.
    - Directus check: verify `UserProgress` has a completed record for the Essay module (`is_completed: true`).
    - The course sidebar progress shows 100% completion (if all videos, quiz, and essay are marked completed).

### **Phase 5 Exit Gate: Google Registration, Account Deletion & Automation Pipeline**
* **Google OAuth Registration:** Custom Google login flow successfully registers new students, bypasses Directus OIDC cookie limitations via server-to-server exchange, and logs users in.
* **Profile Gating:** Users with missing `legal_name` are forced to `/confirm-profile` to input legal names and select a compliance checkbox. NEXT_REDIRECT exceptions are handled correctly.
* **Destructive Deletion:** Destructive "Delete user" button triggers `POST /api/user/delete` with confirmation modal. Relational records in `Purchases`, `UserProgress`, `Submissions`, `Certificates`, and `QuizProgress` are cascadingly deleted before the user's `directus_users` record is removed and cookies are cleared.
* **Webhook Trigger:** Setting status to `Approved` in Directus fires a webhook to n8n.
* **Doc Compilation:** n8n compiles PDF certificate, sends email, and writes PDF URL to Directus `Certificates`.

### **Phase 6 Exit Gate: Payments**
* **Checkout Redirect:** Triggering checkout dynamically creates a Stripe session and redirects the user to the secure payment page.