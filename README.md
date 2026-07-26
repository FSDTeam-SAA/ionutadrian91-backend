# ionutadrian91-backend

NestJS backend using MongoDB, Redis-backed rate limiting/session storage, BullMQ email processing, and Prometheus/Grafana/Loki monitoring.

## Setup

```bash
npm install
cp .env.example .env
npm run docker:dev
npm run start:dev
```

Scalar API Reference is available at:

```bash
http://localhost:5000/api-docs/
```

The generated OpenAPI document is available at:

```bash
http://localhost:5000/api-docs/openapi.json
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
- `docker compose -f docker-compose.prod.yaml up -d` starts the VPS production stack.

## VPS Deployment

The production Compose file runs the backend, MongoDB, and Redis on a private Docker network with persistent volumes, healthchecks, Redis password support, and log rotation.

Required VPS `.env` values:

- `DOCKER_IMAGE=fsdteamsaa/ionutadrian91-backend:<tag>`
- `JWT_SECRET`
- `MONGO_INITDB_ROOT_PASSWORD`

Common optional values:

- `PORT=5000`
- `ENABLE_API_DOCS=false`
- `MONGO_INITDB_ROOT_USERNAME=admin`
- `MONGO_INITDB_DATABASE=ionutadrian91_backend`
- `REDIS_PASSWORD`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`

GitHub Actions deploys the exact image built for the commit SHA to the VPS. Configure repository secrets for Docker Hub and VPS SSH access before running the `Deploy Backend to VPS` workflow.

## Structure

- `src/modules/auth` OTP/JWT authentication and role-aware access.
- `src/modules/user` administrator/office user management and self-service profile endpoints.
- `src/modules/metrics` Prometheus metrics.
- `src/common` shared services, guards, schemas, queues, and config.
