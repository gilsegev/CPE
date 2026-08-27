# Build an LMS Platform: Next.js 13,  React, Stripe, Mux, Prisma, Tailwind, MySQL | Full Course 2023

![Copy of Copy of Copy of Copy of Fullstack Twitter Clone (9)](https://github.com/AntonioErdeljac/next13-lms-platform/assets/23248726/fa077fca-bb74-419a-84de-54ac103bb026)


This is a repository for Build an LMS Platform: Next.js 13,  React, Stripe, Mux, Prisma, Tailwind, MySQL | Full Course 2023

[VIDEO TUTORIAL](https://www.youtube.com/watch?v=Big_aFLmekI)

Key Features:

- Browse & Filter Courses
- Purchase Courses using Square
- Mark Chapters as Completed or Uncompleted
- Progress Calculation of each Course
- Student Dashboard
- Teacher mode
- Create new Courses
- Create new Chapters
- Easily reorder chapter position with drag n’ drop
- Upload thumbnails, attachments and videos using UploadThing
- Video processing using Mux
- HLS Video player using Mux
- Rich text editor for chapter description
- Authentication using Clerk
- ORM using Prisma
- MySQL database using Planetscale

### Prerequisites

**Node version 18.x.x**

### Cloning the repository

```shell
git clone https://github.com/AntonioErdeljac/next13-lms-platform.git
```

### Install packages

```shell
npm i
```

The Directus module-course schema and course-scoped content migration are operated with `npm run migration:module-courses`; read the [Module-Based Course Migration Runbook](./docs/MODULE%20COURSE%20MIGRATION%20RUNBOOK.md) before running it against shared data.

The v2 completion, certificate, feedback, and administrator-observability lifecycle is operated with the [Course Completion and Certificate Runbook](./docs/COURSE%20COMPLETION%20AND%20CERTIFICATE%20RUNBOOK.md). It covers deployment order, administrator reporting and retries, reconciliation, survey verification, and replay/concurrency verification.

### Setup .env file


```js
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=
NEXT_PUBLIC_CLERK_SIGN_UP_URL=
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=

DATABASE_URL=

UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=

MUX_TOKEN_ID=
MUX_TOKEN_SECRET=

SQUARE_ACCESS_TOKEN=
SQUARE_ENVIRONMENT=sandbox
SQUARE_WEBHOOK_SIGNATURE_KEY=
SQUARE_LOCATION_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_TEACHER_ID=
```

### Setup Prisma

Add MySQL Database (I used PlanetScale)

```shell
npx prisma generate
npx prisma db push

```

### Start the app

```shell
npm run dev
```

To inspect the completion survey, dashboard feedback states, and administrator feedback reporting without completing a course, open [http://localhost:3000/dev/feedback-preview](http://localhost:3000/dev/feedback-preview). The localhost preview uses fixtures and suppresses survey, retry, and telemetry writes. Non-local access returns `404` unless `ENABLE_DEV_PREVIEWS=true` is explicitly configured.

## Available commands

Running commands with npm `npm run [command]`

| command         | description                              |
| :-------------- | :--------------------------------------- |
| `dev`           | Starts a development instance of the app |
| `migration:module-courses -- manifest --output <file>` | Produces a read-only course migration inventory. |
| `migration:module-courses -- apply --manifest <file>` | Validates owner-approved migration decisions without writes. |
| `migration:module-courses -- cleanup-check` | Fails closed until legacy behavior can be retired safely. |
| `test` | Runs migration, completion, feedback, and certificate workflow contract tests. |
