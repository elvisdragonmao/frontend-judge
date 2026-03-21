<div align="center">
    <img alt="emjudge logo" src="apps/web/public/emjudge.svg" width="200" />

  <h1>emjudge</h1>
  <p>Frontend assignment submission and automated grading for HTML, CSS, JavaScript, and React projects.</p>

  <p>
    <img alt="Node.js 20+" src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" />
    <img alt="pnpm 10+" src="https://img.shields.io/badge/pnpm-%3E%3D10-F69220?logo=pnpm&logoColor=white" />
    <img alt="React 19" src="https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=061A23" />
    <img alt="Fastify 5" src="https://img.shields.io/badge/fastify-5-000000?logo=fastify&logoColor=white" />
    <img alt="Playwright" src="https://img.shields.io/badge/playwright-grading-2EAD33?logo=playwright&logoColor=white" />
    <img alt="License Apache-2.0" src="https://img.shields.io/badge/license-Apache%202.0-blue" />
  </p>
</div>

## Overview

emjudge is a monorepo application for managing frontend coursework. Students upload assignments, the platform evaluates them inside isolated Docker containers with Playwright, and teachers can review scores, screenshots, logs, and submission history from a web interface.

The system is organized into separate web, API, and worker applications so grading can scale independently from the user-facing product.

## Highlights

- React web app for students, teachers, and admins
- Fastify API with authentication, class management, assignments, and submissions
- Dedicated judge worker that polls grading jobs from PostgreSQL
- Docker-based isolated execution for submitted projects
- Playwright-driven grading with screenshots, logs, and structured test results
- Shared workspace packages for types, schemas, permissions, and config
- Multi-language web UI with Traditional Chinese, Simplified Chinese, and English

## Repository Layout

```text
frontend-judge/
├── apps/
│   ├── api/          # Fastify backend
│   ├── web/          # React + Vite frontend
│   └── worker/       # Judge worker process
├── docker/
│   └── judge-runner/ # Playwright runner image
├── packages/
│   ├── shared/       # Shared types, schemas, constants, templates
│   └── config/       # Shared TypeScript config
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Architecture

### Applications

- `apps/web` - React frontend for authentication, classes, assignments, grading results, and administration
- `apps/api` - Fastify API for auth, user management, classes, assignments, submissions, storage access, and job creation
- `apps/worker` - background judge worker that consumes queued grading jobs and writes results back to PostgreSQL

### Shared Packages

- `packages/shared` - shared Zod schemas, domain types, permissions, constants, and built-in Playwright test templates
- `packages/config` - shared TypeScript configuration used across apps

### Infrastructure

- PostgreSQL for application data and job queue state
- MinIO for uploaded submission files and grading artifacts
- Docker for isolated grading execution

## How Grading Works

1. A student uploads an assignment through the web app.
2. The API stores files in MinIO and creates submission and job records in PostgreSQL.
3. The worker claims a pending job using PostgreSQL locking.
4. The worker downloads files, prepares the grading workspace, and runs the submission inside the `judge-runner` Docker image.
5. Playwright executes the assignment's test script.
6. The worker stores logs, screenshots, and structured results, then updates submission status and score.

## Tech Stack

| Area            | Stack                                                |
| --------------- | ---------------------------------------------------- |
| Frontend        | React, Vite, React Router, React Query, Tailwind CSS |
| Backend         | Fastify, PostgreSQL, Zod, JWT                        |
| Worker          | Node.js, PostgreSQL, MinIO, Docker                   |
| Testing Runtime | Playwright                                           |
| Tooling         | pnpm workspaces, TypeScript                          |

## Prerequisites

| Tool       | Version |
| ---------- | ------- |
| Node.js    | 20+     |
| pnpm       | 10+     |
| Docker     | 24+     |
| PostgreSQL | 15+     |
| MinIO      | latest  |

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local infrastructure

```bash
docker compose up -d
```

This starts local PostgreSQL and MinIO for development.

### 3. Create environment file

```bash
cp .env.example .env
```

At minimum, update these values before real usage:

- `JWT_SECRET`
- `DEFAULT_ADMIN_PASSWORD`

### 4. Initialize the database

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Start the API and web app

```bash
pnpm dev
```

### 6. Start the judge worker in another terminal

```bash
pnpm dev:worker
```

### 7. Build the judge runner image

```bash
docker build -t judge-runner:latest docker/judge-runner/
```

## Development Commands

### Root

```bash
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm dev:worker
pnpm build
pnpm db:migrate
pnpm db:seed
pnpm format
```

### Per App

```bash
pnpm --filter @judge/web build
pnpm --filter @judge/api build
pnpm --filter @judge/worker build
pnpm --filter @judge/shared build
```

## Environment Variables

The project uses a shared root `.env` for local development. See `.env.example` for the full reference.

Commonly used variables include:

- `DATABASE_URL`
- `JWT_SECRET`
- `DEFAULT_ADMIN_PASSWORD`
- `CORS_ORIGIN`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_PUBLIC_BASE_URL`
- `WORK_DIR`
- `JUDGE_IMAGE`
- `WORKER_ID`

## Frontend Internationalization

The web app uses `react-i18next` and ships with:

- `zh-TW`
- `zh-CN`
- `en`

Translation sources live under `apps/web/src/i18n/locales/`, and `crowdin.yml` is configured for translation sync workflows.

## API Documentation

Interactive API documentation is available through Swagger in the running API service: `/api/docs`.

## Deployment

### Build artifacts

```bash
pnpm --filter @judge/shared build
pnpm --filter @judge/web build
pnpm --filter @judge/api build
pnpm --filter @judge/worker build
```

### Run services

```bash
node apps/api/dist/index.js
node apps/worker/dist/index.js
```

The frontend production bundle is generated in `apps/web/dist` and can be served by Nginx or any static file server.

Multiple worker instances can run in parallel as long as each instance has its own `WORKER_ID`.

## Production Notes

- Use a strong `JWT_SECRET`
- Rotate the seeded admin password after setup
- Replace default PostgreSQL and MinIO credentials
- Restrict `CORS_ORIGIN` to trusted domains
- Enable SSL for MinIO in production where applicable
- Build and publish the `judge-runner` image before enabling grading
- Run API and worker processes under a supervisor such as systemd, PM2, or containers
- Ensure Docker permissions and resource limits are reviewed before accepting untrusted submissions

## Assignment Authoring

Assignments support two grading modes:

- `html-css-js`
- `react`

Teachers can define:

- title
- markdown description
- assignment type
- due date
- whether multiple submissions are allowed
- Playwright grading script

The web app also includes built-in Playwright test templates to speed up assignment authoring.

## Data Model Summary

Core entities include:

- users
- classes
- class members
- assignments
- assignment specs
- submissions
- submission files
- submission runs
- submission artifacts
- judge jobs
- password reset logs
- bulk import jobs

The SQL schema lives in `apps/api/src/db/schema.sql`.

## Typical Workflow

### Admin

1. Sign in with the seeded admin account.
2. Create users individually or through bulk import.
3. Create classes.
4. Add students and teachers to classes.

### Teacher

1. Open a class.
2. Create an assignment.
3. Add instructions and a Playwright grading script.
4. Review submissions, screenshots, logs, and scores.

### Student

1. Open a class.
2. View assignment requirements.
3. Upload files or a project folder.
4. Wait for grading to complete.
5. Review score, screenshots, logs, and test output.

## Community Health

- Code of Conduct: `CODE_OF_CONDUCT.md`
- Contributing Guide: `CONTRIBUTING.md`
- Security Policy: `SECURITY.md`
- License: `LICENSE`

## Contributing

If you extend the system, prefer keeping cross-app contracts in `packages/shared`, and keep user-facing API details documented in Swagger rather than duplicating them in Markdown. For contribution workflow, review `CONTRIBUTING.md` before opening an issue or pull request.
