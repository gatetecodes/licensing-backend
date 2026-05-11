# BNR Licensing — Backend API

REST API for the Bank Licensing & Compliance Portal: applications and documents, reviewer/approver workflow, sessions, admin user lifecycle, and audit trail. Consumed by the SPA under `/api/v1`.

## Stack

- **Runtime:** Node.js, TypeScript, Express 5
- **Data:** PostgreSQL + Sequelize, Redis (sessions / infra)
- **Auth:** Server-side sessions (`bnr.sid`), CSRF on mutating `/api/v1` routes (after session), CORS locked to `BNR_APP_URL`
- **Email:** Resend (verification, invitations, workflow notifications)
- **Docs:** OpenAPI served at `/api-docs/v1` (Swagger UI)

## Prerequisites

- PostgreSQL and Redis reachable from the app
- Environment variables (see below); optional `.env` at repo root (`dotenv`)

## Local setup

```bash
npm ci
npm run build          # compile to dist/ (use before start in prod)
npm run db:migrate:up
npm run db:seed        # demo users/applications; requires seed-related env where used
npm run dev            # default port 4009 unless PORT is set
```

- **Health:** `GET /health`
- **API base:** `/api/v1` (e.g. `/api/v1/applications`, `/api/v1/auth/...`)
- **Migrations:** `npm run db:migrate:create -- <name>` to add a migration, then `db:migrate:up` / `db:migrate:down`

## Configuration

[config](config) uses [node-config](https://github.com/node-config/node-config): `default.json` plus `development` / `production` / `test` by `NODE_ENV`. **Secrets and URLs are overridden from the environment** — names are listed in:

**[`config/custom-environment-variables.json`](config/custom-environment-variables.json)**

Minimum you typically set for a real environment:

| Variable                                          | Purpose                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `BNR_DATABASE_URI`                                | PostgreSQL connection string                                              |
| `BNR_REDIS_HOST` (and port/password if needed)    | Redis                                                                     |
| `BNR_SECRET_KEY`                                  | Session signing                                                           |
| `BNR_APP_URL`                                     | Allowed browser origin for CORS (frontend origin, no trailing path noise) |
| `BNR_RESEND_API_KEY` / sender fields              | Outbound email                                                            |
| `BNR_VERIFY_EMAIL_URI` / `BNR_RESET_PASSWORD_URI` | Link bases in emails (must point at frontend routes)                      |

Optional: `BNR_DOCUMENTS_STORAGE_DIR` (defaults under `storage/documents` in config), `PORT`, `BNR_MAX_UPLOAD_SIZE`, `BNR_MAX_JSON_LIMIT`.

## Scripts

| Command                           | Description                                                             |
| --------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                     | Nodemon + `src/server.ts`                                               |
| `npm run build`                   | `tsc` + static asset copy → `dist/`                                     |
| `npm start`                       | `node dist/server.js`                                                   |
| `npm test`                        | Jest (uses in-memory SQLite in `config/test.json` when `NODE_ENV=test`) |
| `npm run lint:check` / `lint:fix` | ESLint                                                                  |
| `npm run db:migrate:up` / `down`  | Run migrations                                                          |

## Design notes

- **Workflow** transitions and optimistic locking (`lock_version`) live in services (e.g. `workflow.service`); API validates input with Celebrate/Joi where configured.
- **Documents** are stored on disk (configurable directory); metadata and versions in PostgreSQL.
- **Roles:** applicant vs internal roles (`REVIEWER`, `APPROVER`, `ADMIN`, `SUPER_ADMIN`) drive route guards and workflow checks.

For UI behaviour, environment-specific copy, and end-user flows, see the **frontend** repository README.
