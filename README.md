# StockFlow

StockFlow is an inventory and invoicing API built with NestJS, PostgreSQL, and Prisma. The frontend is a separate Next.js application in `../eterna-frontend-test`.

## Prerequisites

- Node.js 24 or newer and npm
- Docker Desktop with Docker Compose, or PostgreSQL 16 or newer
- Git

All backend commands below run from `eterna-backend-test`. Frontend commands run from `eterna-frontend-test`.

## Local setup

```bash
cd eterna-backend-test
npm install
cp .env.example .env
```

The checked-in `.env.example` contains safe local placeholders only. Set a unique, long `SESSION_TOKEN_PEPPER` in `.env`; never commit `.env` or real secrets.

### PostgreSQL with Docker Compose

From `eterna-backend-test`, start the database and API:

```bash
docker compose up --build
```

Compose starts PostgreSQL, applies migrations through the `migrate` service, and starts the backend at `http://localhost:8000`. It currently starts only PostgreSQL and the backend; start the frontend separately as described below.

To seed the Compose database:

```bash
docker compose run --rm migrate npm run db:seed
```

Stop the services while retaining the local database volume with `docker compose down`.

### PostgreSQL without Docker

Create a database matching `DATABASE_URL`, then run from `eterna-backend-test`:

```bash
npm run prisma:generate
npx prisma migrate deploy
npm run db:seed
```

For local schema development, `npm run prisma:migrate -- --name describe-change` creates and applies a migration. Do not use `prisma db push` as a substitute for the committed migration history.

## Environment variables

Backend variables are documented in `eterna-backend-test/.env.example`:

| Variable                 | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `DATABASE_URL`           | PostgreSQL connection used by the API and Prisma CLI                |
| `PORT`                   | API port, normally `8000`                                           |
| `NODE_ENV`               | `development`, `test`, or `production`                              |
| `FRONTEND_ORIGIN`        | Browser origin allowed by the API, normally `http://localhost:3000` |
| `CORS_ORIGINS`           | Comma-separated explicit CORS allowlist                             |
| `SESSION_DURATION_HOURS` | Session lifetime                                                    |
| `SESSION_TOKEN_PEPPER`   | Secret used to hash opaque session tokens                           |
| `TAX_RATE_BASIS_POINTS`  | Tax rate in basis points; `1100` means 11%                          |

The frontend has its own `eterna-frontend-test/.env.example`, containing `NEXT_PUBLIC_API_BASE_URL`, the backend origin used by browser requests.

## Seed data

`npm run db:seed` creates or updates the demo account and three products:

- Email: `demo@stockflow.local`
- Password: `stockflow-demo-password`
- Admin email: `demo@stockflow.local` / `stockflow-demo-password`
- Staff email: `staff@stockflow.local` / `stockflow-staff-password`

The seed uses an upsert for the user and skips duplicate products, so it is safe to run repeatedly on the local database.

Admins can perform every operation. Staff can view, create, and update products and invoices, but product deletion is rejected with `403` by the backend. The frontend hides the delete action for staff as a convenience only.

## Run the applications

With PostgreSQL available, start the backend from `eterna-backend-test`:

```bash
npm run start:dev
```

Swagger is available at `http://localhost:8000/api-docs`. In a second terminal, start the frontend from `eterna-frontend-test`:

```bash
cd ../eterna-frontend-test
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The browser uses the backend's HttpOnly session cookie with credentials; it does not store a bearer token.

## Tests, lint, and builds

Backend commands, from `eterna-backend-test`:

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

`npm test` runs fast unit and controller tests. They use repository fakes or mocks and never connect to PostgreSQL. `npm run test:e2e` selects files ending in `.e2e-spec.ts`; these boot small Nest test applications and use repository/service mocks, so they do not require PostgreSQL. They verify cookie authentication and the unauthenticated `401` contract.

The Prisma integration test requires a disposable PostgreSQL database whose name ends in `_test`; it fails loudly when the variable is missing rather than silently skipping:

```bash
export INTEGRATION_DATABASE_URL='postgresql://stockflow:stockflow@localhost:5432/stockflow_test?schema=public'
DATABASE_URL="$INTEGRATION_DATABASE_URL" npx prisma migrate deploy
npm run test:integration
```

Run these commands from `eterna-backend-test`. `INTEGRATION_DATABASE_URL` is passed directly to a separate Prisma client; it is never the development, staging, or production `DATABASE_URL`. The test cleans its isolated database before each run and exercises real transactional invoice stock decrement and rollback behavior. Apply migrations to that database before running it. Do not put this variable, credentials, or a real connection string in a committed env file.

Frontend commands, from `eterna-frontend-test`:

```bash
npm run lint
npm test
npm run build
```

The frontend tests mock `fetch` at the API adapter boundary and never call a live backend.

For a production backend build and start, from `eterna-backend-test`:

```bash
npm run build
npm run start:prod
```

For a production frontend build and start, from `eterna-frontend-test`:

```bash
npm run build
npm run start
```

## API contract

Successful endpoints return a non-empty backend-generated `message` and `data`. Errors consistently return `{ status, message, data: null }`. The API uses `400` for invalid input or insufficient stock, `401` for missing or invalid authentication, `403` for rejected origins or authorization, `404` for missing owned resources, `409` for conflicts and illegal transitions, and `500` for unexpected failures. Auth success responses include messages too; cookie authentication is unchanged.

Products are soft-deleted so invoice references remain intact. Invoice lines snapshot product names and integer-cent prices. Issuing and cancelling issued invoices update stock transactionally with serializable isolation and conditional updates. The active-SKU uniqueness rule is a deliberate PostgreSQL partial unique index maintained by a migration; Prisma does not express partial indexes in `schema.prisma`.

## Implemented bonuses

- Session expiration is configurable with `SESSION_DURATION_HOURS`; every request checks expiry and logout revokes the server-side session.
- Roles are stored as `ADMIN` or `STAFF`. Staff may manage products and invoices but receive `403` when deleting products; only admins see the delete action in the frontend.
- Login attempts are limited by `LOGIN_RATE_LIMIT_MAX` within `LOGIN_RATE_LIMIT_WINDOW_SECONDS`. The limiter is process-local and intended for this single-instance exercise.
- Stock movements are append-only records for initial stock, manual quantity adjustments, invoice issues, and invoice cancellations. They are written in the same transaction as stock changes.
- Invoice issue and cancellation use serializable transactions, conditional status/stock updates, and retries for transient serialization conflicts.
- Invoice details include a print action. Print CSS hides application navigation and controls while preserving invoice data.

Deployment and CI/CD are intentionally not included.

## Tech choices and trade-offs

- NestJS provides explicit modules, guards, validation, and Swagger support.
- Prisma with PostgreSQL provides relational constraints and durable data.
- TypeScript and repository interfaces keep business logic independently testable.
- Argon2id hashes passwords with per-password salts.
- Opaque HttpOnly sessions allow server-side revocation without exposing tokens to JavaScript.
- Integer cents avoid floating-point currency errors.
- Serializable invoice transactions improve correctness but can require retrying a conflict.
- Soft deletion preserves invoice history but means deleted products remain in the database.

## Known limitations and one-week improvements

The frontend is not included in the current Compose stack, and integration test database provisioning remains a local prerequisite. With one more week, I would improve operational observability, strengthen concurrent-issue scenarios, and add richer audit history.

## AI Usage

GitHub Copilot assisted with implementation, tests, and documentation. Estimated implementation time: 8 hours.
