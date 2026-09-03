# StockFlow API

NestJS, PostgreSQL, Prisma, and opaque HttpOnly browser sessions for StockFlow.

## Setup

1. Install Node.js 24+ and PostgreSQL 16+ (or use Docker Compose).
2. Run `npm install`, then copy `.env.example` to `.env` and set a strong `SESSION_TOKEN_PEPPER`.
3. Create the database configured by `DATABASE_URL`.
4. Run `npm run prisma:generate && npx prisma migrate deploy && npm run db:seed`.
5. Start the API with `npm run start:dev` at `http://localhost:8000`; Swagger is at `http://localhost:8000/api-docs`.

For Docker, run `docker compose up --build`; Compose applies migrations before starting the API. Seed with `docker compose run --rm migrate npm run db:seed`.

Demo account: `demo@stockflow.local` / `stockflow-demo-password`.

## Environment

See `.env.example`. `DATABASE_URL`, `FRONTEND_ORIGIN`, `CORS_ORIGINS`, `SESSION_DURATION_HOURS`, `SESSION_TOKEN_PEPPER`, and `TAX_RATE_BASIS_POINTS` are required operational settings. Production requires a 32-character-or-longer token pepper and sets the session cookie `Secure`; development defaults to `http://localhost:8000` and a non-Secure cookie for local HTTP.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Register a user |
| POST | `/auth/login` | Set opaque session cookie |
| GET | `/auth/me` | Read authenticated user |
| POST | `/auth/logout` | Revoke session and clear cookie |
| GET/POST | `/products` | List/create active products owned by the session user |
| GET/PATCH/DELETE | `/products/:id` | Read/update/soft-delete an owned active product |
| GET/POST | `/invoices` | List/create owned invoices |
| GET | `/invoices/:id` | Read an owned invoice |
| PATCH | `/invoices/:id` | Edit an owned DRAFT invoice |
| PATCH | `/invoices/:id/status` | Issue, pay, or cancel an invoice |

All protected routes use the `stockflow_session` HttpOnly, `SameSite=Lax` cookie. State-changing operations require an allowed `Origin` or `Referer`, and CORS permits only explicit configured origins with credentials. Passwords use Argon2id. Session rows contain an HMAC-SHA-256 hash of a cryptographically random token, never the raw cookie value. Product and invoice repositories scope every record operation by the authenticated user ID. Product deletes set `deletedAt` and return `404` for missing, foreign-owned, or already deleted products; rows and invoice references are preserved, and SKUs can be reused after deletion. Active product reads always filter deleted rows.

## Validation

Run `npm run prisma:generate`, `npm run build`, `npm run lint`, `npm test`, and `npm run test:e2e`. E2E requires an isolated PostgreSQL database configured through `DATABASE_URL`.

## Decisions

- PostgreSQL/Prisma gives durable relational persistence and database constraints.
- Argon2id is used for per-password salted hashing.
- Opaque sessions allow immediate server-side revocation without exposing a bearer token to JavaScript.
- The invoice number is random-suffixed to avoid a race-prone global counter.
- Line items are price/name snapshots; editing is allowed only while an invoice is DRAFT and replaces its lines transactionally.

## AI Usage

GitHub Copilot assisted with implementation, tests, and documentation. Estimated implementation time: 8 hours.

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
