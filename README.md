# ionutadrian91-backend

NestJS backend using MongoDB, Redis-backed rate limiting/session storage, BullMQ email processing, and Prometheus/Grafana/Loki monitoring.

## Setup

```bash
npm install
cp .env.example .env
npm run docker:dev
npm run start:dev
```

Set `MONGODB_URI` for the application database. The local Docker default is:

```bash
MONGODB_URI=mongodb://admin:admin@localhost:27017/ionutadrian91_backend?authSource=admin
```

## Scripts

- `npm run start:dev` starts Nest in watch mode.
- `npm run build` compiles the app.
- `npm test` runs unit tests.
- `npm run docker:dev` starts local Docker services.

## Structure

- `src/modules/auth` authentication and Google OAuth.
- `src/modules/user` user endpoints.
- `src/modules/metrics` Prometheus metrics.
- `src/common` shared services, guards, schemas, queues, and config.
