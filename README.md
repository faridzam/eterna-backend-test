# StockFlow API

## Setup and run

From a fresh machine with Node.js 24+, npm, and PostgreSQL running locally:

```bash
cd eterna-backend-test
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

The API runs at `http://localhost:8000`; Swagger is at `http://localhost:8000/api-docs`. Set `DATABASE_URL` to your local PostgreSQL database and use a unique `SESSION_TOKEN_PEPPER` in `.env`. For a production build, run `npm run build` followed by `npm run start:prod`.

The default CORS origin is `http://localhost:3000` for the web app.

Useful checks:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

## Demo login credentials

- Admin: `admin@stockflow.com` / `stockflow`
- Staff: `staff@stockflow.com` / `stockflow`

## Tech choices and why

- NestJS provides explicit modules, guards, validation, and Swagger support.
- TypeScript makes API contracts and domain boundaries easier to maintain.
- PostgreSQL provides durable relational storage and database-level constraints.
- Prisma provides typed queries and a migration workflow.
- Argon2id hashes passwords using a modern password-hashing algorithm.
- Opaque HttpOnly sessions support server-side revocation without exposing tokens to JavaScript.
- Integer cents avoid floating-point currency errors.
- Serializable transactions protect stock changes during invoice issue and cancellation.
- Soft deletion preserves product references required by historical invoices.

## Trade-offs and known limitations

- Session metadata and the process-local login rate limiter are not backed by Redis, so horizontal scaling would need additional infrastructure.
- The frontend is a separate application and must be started separately.
- Integration tests require a separately provisioned disposable PostgreSQL database.
- RBAC is currently limited to `ADMIN` and `STAFF` roles on the user record rather than configurable permissions.
- There is no production deployment, monitoring, alerting, or centralized audit-log service.
- Product deletion is soft deletion, so database records are retained intentionally.

## What I would do with one more week

- Split authorization into configurable users, roles, permissions, and resource policies.
- Add Redis-backed sessions and rate limiting for multi-instance deployment.
- Add structured logs, metrics, tracing, and an administrator-facing audit history.
- Expand concurrency and failure testing around invoice issuance, cancellation, and retries.
- Add deployment automation, secrets management, backups, and a production readiness checklist.
- Add API versioning for major changes

## AI Usage

GitHub Copilot assisted with implementation, test creation, debugging, and documentation. I reviewed and ran the resulting code and tests. Approximately 8 hours total using AI.
