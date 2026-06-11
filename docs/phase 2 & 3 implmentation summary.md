Deployed Functionality (Phase 2 & Phase 3)
We have fully integrated the LMS template with your Directus backend, enabling the following features:

Custom B2C Authentication: A fully native /sign-up and /sign-in portal. The sign-up form explicitly collects Legal Name for Certificate (required) and TEA ID (optional) and registers users directly into your PostgreSQL database via Directus.
Session Protection: A custom middleware checks and automatically refreshes user access tokens using secure HTTP-only cookies, protecting all course routes.
Dynamic Data Loading: The /search (Browse) and /courses pages fetch published courses, modules (chapters), and student progress dynamically from Directus.
Stripe Checkout & Webhooks: Next.js generates Stripe payment sessions and receives payment success webhooks, which automatically write active course Purchases records into Directus.
Mux Video Player: Integrates the standard <MuxPlayer /> component for module video streaming.
3. Deactivated Teacher Dashboard (Admin Module)
In the original Antonio LMS template, course creators used teacher-facing pages inside Next.js to upload files and configure lessons. Because your platform is built on Directus, Directus is your Admin Panel out of the box! This saves you from having to build and maintain custom intake panels.

To configure and populate your courses:

Open your Directus Dashboard: https://directus-production-69c0.up.railway.app/admin
Log in using your admin credentials.
In the sidebar, select Courses and click + to add a new course:
Provide a Title, Description, and Price.
Set the Status dropdown to Published and toggle Is Published to true (unauthenticated users can only see published courses).
Go to Modules (representing Chapters) and click + to add a module linked to your course:
Provide a Title and Order Index (e.g. 1, 2, 3).
Enter your Mux Playback ID under Mux Asset ID (Note: despite the field name "Mux Asset ID", you must enter the Playback ID from your Mux dashboard, not the Asset ID, for video streaming to work).
Toggle Is Free Preview if you want it playable without purchasing.
Reload your Next.js app, and you will see the populated courses and chapters load instantly on the Browse page!