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
* **Implementation:** Integrate the @directus/sdk in Next.js. Authentication handles sessions via Directus JWTs. All Next.js data fetching (e.g., loading course lists) is executed via REST/GraphQL queries to the Directus endpoints using the authenticated user's token, ensuring Role-Based Access Control (RBAC) is respected.

### **4.2 Payment & Access Provisioning (Stripe)**

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

## **5\. Implementation Phases**

1. **Phase 1: Infrastructure & Backend Foundation**  
   * Provision managed PostgreSQL DB and Directus instance (e.g., Railway/DigitalOcean).  
   * Define all Data Schema collections and relationships inside Directus.  
   * Configure Directus Roles and Permissions (Public, Student, Admin).  
2. **Phase 2: Frontend Surgery**  
   * Clone the Antonio Next.js repo.  
   * Strip out Prisma and Clerk.  
   * Wire up the @directus/sdk for authentication and fetch dynamic course data.  
3. **Phase 3: Video & Payments**  
   * Connect Mux for module video playback.  
   * Integrate Stripe Checkout and setup the webhook listener in Directus.  
4. **Phase 4: Custom Assessment Engineering**  
   * Build the Frontend Quiz & Essay submission UI.  
   * Implement the submission logic and Directus storage.  
5. **Phase 5: Automation Pipeline**  
   * Deploy n8n.  
   * Design the Google Doc Certificate template.  
   * Build the Webhook \-\> n8n \-\> Google Doc \-\> PDF \-\> Email flow.