<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">NestJS + Prisma + PostgreSQL Starter Template</h1>

<p align="center">
  A production-ready, enterprise-grade starter template for building scalable backend applications with NestJS, Prisma ORM, and PostgreSQL.
</p>

<p align="center">
  <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node Version" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-7.x-2D3748" alt="Prisma" />
</p>

---

## 📋 Table of Contents

- [Why This Starter?](#-why-this-starter)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [System Overview](#-system-overview)
  - [Authentication System](#authentication-system)
  - [Database Design](#-database-design)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Configuration](#-environment-configuration)
- [API Reference](#-api-reference)
- [Docker Setup](#-docker-setup)
- [Monitoring Stack](#-monitoring-stack)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Testing](#-testing)
- [Production Deployment](#-production-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Why This Starter?

This isn't just another boilerplate—it's a **battle-tested, production-grade foundation** that implements enterprise security patterns and best practices out of the box:

| Feature | Why It Matters |
|---------|----------------|
| **JWT + Refresh Token Rotation** | Prevents token theft with automatic rotation on each refresh |
| **Rate Limiting & Account Lockout** | Protects against brute force attacks |
| **Timing Attack Prevention** | Consistent response times prevent user enumeration |
| **Distributed Locks (Redis)** | Prevents race conditions in concurrent operations |
| **Token Version for Instant Revocation** | Immediately invalidate all user sessions on security events |
| **Centralized Logging (Loki)** | Aggregate logs from all services for debugging |
| **Prometheus Metrics** | Real-time performance monitoring and alerting |
| **Multi-stage Docker Builds** | Optimized production images (~50% smaller) |

---

## ✨ Features

### 🔐 Authentication & Security
- **JWT Authentication** with access & refresh tokens
- **Token Rotation** - New refresh token on each refresh (prevents token theft)
- **Email Verification** with 6-digit OTP codes (24h expiry)
- **Google OAuth 2.0** - Complete social login integration
- **Rate Limiting** (per-email, per-IP based)
- **Account Lockout** - 30 min lockout after 5 failed attempts
- **Password Strength Validation** - Min 8 chars with complexity requirements
- **Hybrid Token Validation** (Redis cache + DB fallback for speed)
- **Timing Attack Prevention** - Consistent response times

### 📧 Email System (BullMQ)
- **Async Email Processing** with BullMQ job queue
- **Automatic Retries** - 3 attempts with exponential backoff
- **Email Templates** - HTML templates for verification & welcome emails
- **Email History Tracking** - Full audit trail in database
- **Multiple Email Types** - Verification, password reset, notifications

### 🔗 OAuth Integration
- **Google OAuth 2.0** - Login with Google account
- **Provider Abstraction** - Easy to add more providers (GitHub, Facebook)
- **Account Linking** - Link OAuth to existing accounts
- **Secure Callback Handling** - State validation and token exchange

### 📦 Infrastructure
- **PostgreSQL 17** with Prisma ORM (modular schema)
- **Redis Stack** for caching, sessions, and distributed locks
- **BullMQ** for background job processing (emails, notifications)
- **Docker Compose** for local development
- **Multi-stage Docker builds** for production (~50% smaller images)

### 📊 Monitoring & Observability
- **Prometheus** metrics collection (request duration, errors, active users)
- **Grafana** dashboards (auto-provisioned)
- **Loki** log aggregation (structured JSON logs)
- **Winston** structured logging with multiple transports
- **Health checks** on startup

### 🚀 Developer Experience
- **TypeScript 5.7** with strict mode
- **ESLint + Prettier** configured
- **Unit tests** with Jest + mocks
- **Postman collection** included (all endpoints)
- **Hot reload** in development
- **CI/CD** with GitHub Actions (Docker Hub + EC2)

---

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | NestJS 11 |
| **Language** | TypeScript 5.7 |
| **ORM** | Prisma 7 |
| **Database** | PostgreSQL 17 |
| **Cache/Queue** | Redis Stack (with RedisInsight UI) |
| **Job Queue** | BullMQ |
| **Auth** | JWT (jsonwebtoken) |
| **Validation** | class-validator, class-transformer |
| **Logging** | Winston + Loki |
| **Metrics** | Prometheus (prom-client) |
| **Visualization** | Grafana |
| **Email** | Nodemailer |
| **Testing** | Jest |
| **Containerization** | Docker, Docker Compose |
| **CI/CD** | GitHub Actions |

---

# 🔐 System Overview

## Authentication System

### Registration Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
    participant R as Redis
    participant DB as PostgreSQL
    participant Q as BullMQ

    C->>A: POST /auth/signup
    A->>R: Check rate limit (email + IP)
    A->>A: Validate password strength
    A->>DB: Check existing email/username
    A->>A: Hash password (bcrypt, 12 rounds)
    A->>DB: Create user + security record (transaction)
    A->>A: Generate 6-digit verification code
    A->>R: Store code
    A->>Q: Queue verification email
    A-->>C: 201 Created
    
    Note over C,Q: User receives email with code

    C->>A: POST /auth/verify-email
    A->>R: Validate code
    A->>DB: Mark user as verified
    A->>Q: Queue welcome email
    A-->>C: 200 OK (Email verified)
```

### Login Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
    participant R as Redis
    participant DB as PostgreSQL

    C->>A: POST /auth/login
    A->>R: Check rate limit (email + IP)
    A->>DB: Fetch user with security data
    
    alt User not found
        A->>A: Run fake bcrypt (timing attack prevention)
        A-->>C: 401 Invalid credentials
    end
    
    A->>A: Check account status
    A->>A: Check account lockout
    A->>A: Verify password (bcrypt)
    A->>A: Check email verification
    A->>R: Acquire distributed lock
    A->>A: Generate Access Token (15min)
    A->>A: Generate Refresh Token (7d) with JTI
    A->>R: Store refresh token hash
    A->>R: Track session in user's session list
    A->>A: Enforce max devices (revoke oldest if exceeded)
    A-->>C: 200 OK (tokens + user info)
```

### Token Refresh Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
    participant R as Redis
    participant DB as PostgreSQL

    C->>A: POST /auth/refresh
    A->>A: Verify refresh token signature
    A->>R: Get stored token by JTI
    
    alt Token not found (possibly reused)
        A->>R: Revoke ALL user tokens
        A-->>C: 401 Token revoked
    end
    
    A->>A: Validate token hash
    A->>DB: Check user status
    
    Note over A,R: Token Rotation
    A->>R: Delete old refresh token
    A->>A: Generate new JTI
    A->>A: Create new access + refresh tokens
    A->>R: Store new refresh token
    A-->>C: 200 OK (new tokens)
```

### Google OAuth Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
    participant G as Google OAuth
    participant R as Redis
    participant DB as PostgreSQL

    C->>A: GET /auth/google?redirectUrl=...
    A->>A: Generate state token (CSRF protection)
    A->>R: Store state with metadata (5 min TTL)
    A-->>C: Return Google authorization URL

    C->>G: Redirect to Google consent screen
    G->>G: User authenticates & consents
    G->>A: GET /auth/google/callback?code=...&state=...

    A->>R: Validate state token (CSRF check)
    A->>G: Exchange code for tokens
    G-->>A: Return access_token, id_token
    A->>G: Fetch user profile from id_token
    
    alt New User
        A->>DB: Create user with provider=google
        A->>DB: Mark as verified (Google verified email)
    else Existing User
        A->>DB: Update last login
    end

    A->>A: Generate JWT access token
    A->>A: Generate refresh token with JTI
    A->>R: Store refresh token hash
    A-->>C: Redirect to frontend with tokens
```

### Auth Guard & Authorization Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as AuthGuard
    participant R as Redis
    participant DB as PostgreSQL
    participant Ctrl as Controller

    C->>G: Request with Authorization
    G->>G: Extract token from header
    
    alt No token provided
        G-->>C: 401 Unauthorized - No token found
    end

    G->>G: Verify JWT signature & expiry
    
    alt Invalid/Expired token
        G-->>C: 401 Unauthorized - Invalid token
    end

    G->>G: Extract userId, role, tokenVersion from JWT
    
    Note over G,R: Hybrid Token Validation
    G->>R: GET tokenVersion from cache
    
    alt Cache hit
        G->>G: Compare tokenVersion
    else Cache miss
        G->>DB: Fetch user tokenVersion & status
        G->>R: Cache tokenVersion 
    end

    alt tokenVersion mismatch
        G-->>C: 401 Unauthorized - Token revoked
    end

    alt User status != ACTIVE
        G-->>C: 401 Unauthorized - Account inactive
    end

    G->>G: Attach user payload to request
    G->>Ctrl: Request proceeds to controller
    Ctrl-->>C: Response
```


### Security Features

| Feature | Configuration |
|---------|---------------|
| **Access Token Expiry** | 15 minutes |
| **Refresh Token Expiry** | 7 days |
| **Max Login Attempts** | 5 per 15 minutes |
| **Account Lockout** | 30 minutes after max attempts |
| **Max Devices per User** | 5 simultaneous sessions |
| **Password Requirements** | Min 8 chars, uppercase, lowercase, number, special char |
| **Verification Code Expiry** | 24 hours |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/signup` | Register new user |
| `POST` | `/auth/verify-email` | Verify email with OTP |
| `POST` | `/auth/resend-verification` | Resend verification email |
| `POST` | `/auth/login` | Login and get tokens |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Logout (revoke refresh token) |
| `POST` | `/auth/logout-all` | Logout all devices |
| `POST` | `/auth/forgot-password` | Request password reset |
| `POST` | `/auth/reset-password` | Reset password with token |
| `POST` | `/auth/change-password` | Change password (authenticated) |
| `GET` | `/auth/sessions` | List active sessions |
| `DELETE` | `/auth/sessions/:jti` | Revoke specific session |
| `GET` | `/auth/google` | Initiate Google OAuth |
| `GET` | `/auth/google/callback` | Google OAuth callback |

---

## 🗄️ Database Design

### Core Authentication Schema

```mermaid
erDiagram
    authUser ||--o| authSecurity : has
    authUser ||--o| userProfile : has
    authUser ||--o{ loginHistory : logs
    authUser ||--o{ emailHistory : sends
    authUser ||--o{ ActivityLogEvent : tracks
    authUser ||--o{ Subscription : subscribes

    authUser {
        uuid id PK
        string email UK
        string password
        string username UK
        enum role "USER|ADMIN|MODERATOR|SUPERADMIN"
        boolean verified
        enum status "ACTIVE|INACTIVE|SUSPENDED|DELETED|BLOCKED"
        int tokenVersion
        string provider "local|google"
        string providerId
        datetime deletedAt
        datetime createdAt
        datetime updatedAt
    }

    authSecurity {
        uuid id PK
        uuid authId FK,UK
        int failedAttempts
        datetime lastFailedAt
        datetime lockExpiresAt
        boolean mfaEnabled
        enum mfaMethod "totp|sms|email|webauthn"
        string mfaSecret
        datetime lastPasswordChange
    }

    userProfile {
        uuid id PK
        uuid authId FK,UK
        string firstName
        string lastName
        string avatarUrl
    }

    loginHistory {
        uuid id PK
        uuid authId FK
        enum action "login|logout"
        string ipAddress
        string userAgent
        string device
        boolean success
        string failureReason
        int attemptNumber
        datetime createdAt
    }

    emailHistory {
        uuid id PK
        uuid authId FK
        string emailTo
        enum emailType "verification|password_reset|notification"
        string subject
        string messageId
        enum emailStatus "sent|failed|pending|bounced|delivered"
        string ipAddress
        string userAgent
        string errorMessage
        datetime sentAt
        datetime createdAt
    }

    ActivityLogEvent {
        uuid id PK
        uuid authId FK
        string entityType
        string entityId
        enum eventType "create|update|delete|login|logout|password_change"
        json changes
        string ipAddress
        string userAgent
        datetime createdAt
    }
```

### Subscription & Billing Schema

```mermaid
erDiagram
    authUser ||--o{ Subscription : has
    SubscriptionPlan ||--o{ Subscription : offers
    Subscription ||--o{ Payment : processes
    Subscription ||--o{ Invoice : generates

    SubscriptionPlan {
        uuid id PK
        string name UK
        string description
        decimal price "10,2"
        string currency "USD"
        enum interval "DAY|WEEK|MONTH|YEAR"
        int intervalCount
        int trialPeriodDays
        json features
        boolean isActive
    }

    Subscription {
        uuid id PK
        uuid authId FK
        uuid planId FK
        enum status "ACTIVE|PAST_DUE|CANCELED|TRIALING"
        datetime currentPeriodStart
        datetime currentPeriodEnd
        boolean cancelAtPeriodEnd
        datetime canceledAt
        datetime trialStart
        datetime trialEnd
    }

    Payment {
        uuid id PK
        uuid subscriptionId FK
        decimal amount "10,2"
        string currency
        enum status "PENDING|PROCESSING|SUCCEEDED|FAILED|REFUNDED"
        string provider "stripe|paypal"
        string providerPaymentId
        json metadata
    }

    Invoice {
        uuid id PK
        uuid subscriptionId FK
        string invoiceNumber UK
        decimal amount "10,2"
        string currency
        enum status "DRAFT|OPEN|PAID|VOID"
        datetime dueDate
        datetime paidAt
        string invoiceUrl
    }
```

### Enums

```typescript
// User Roles
enum userRole {
  USER
  ADMIN
  MODERATOR
  SUPERADMIN
}

// User Status
enum userStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  DELETED
  BLOCKED
}

// Subscription Status
enum subscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
  INCOMPLETE
  INCOMPLETE_EXPIRED
  UNPAID
}

// Billing Interval
enum billingInterval {
  DAY
  WEEK
  MONTH
  YEAR
}
```

### Running Migrations

```bash
# Create a new migration
npx prisma migrate dev --name your_migration_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate Prisma Client
npx prisma generate
```

---


## 📁 Project Structure

```
nestjs-prisma-postgres-starter/
├── 📂 src/
│   ├── 📂 auth/                    # Authentication module
│   │   ├── 📂 config/              # Auth configuration (timeouts, limits)
│   │   ├── 📂 dto/                 # Data transfer objects
│   │   ├── 📂 interfaces/          # TypeScript interfaces
│   │   ├── 📂 services/            # Auth utility services
│   │   ├── auth.controller.ts      # Auth endpoints
│   │   ├── auth.service.ts         # Core auth business logic
│   │   └── auth.module.ts          # Module definition
│   │
│   ├── 📂 common/                  # Shared utilities
│   │   ├── 📂 config/              # App & Winston configuration
│   │   ├── 📂 dto/                 # Shared DTOs
│   │   ├── 📂 errors/              # Custom error classes
│   │   ├── 📂 filters/             # Exception filters
│   │   ├── 📂 guards/              # Auth guards
│   │   ├── 📂 interceptors/        # Response & metrics interceptors
│   │   ├── 📂 modules/             # Logger, Redis, Queue modules
│   │   ├── 📂 queues/              # BullMQ email queue
│   │   └── 📂 services/            # Prisma, Redis, Logger services
│   │
│   ├── 📂 metrics/                 # Prometheus metrics
│   │   ├── metrics.controller.ts   # /metrics endpoint
│   │   ├── metrics.service.ts      # Metric definitions
│   │   └── metrics.interceptor.ts  # Request tracking
│   │
│   ├── 📂 user/                    # User management module
│   │   ├── 📂 dto/                 # User DTOs
│   │   ├── user.controller.ts      # User endpoints
│   │   └── user.service.ts         # User business logic
│   │
│   ├── app.module.ts               # Root module
│   ├── app.controller.ts           # Health check endpoint
│   └── main.ts                     # Application bootstrap
│
├── 📂 prisma/
│   ├── 📂 schema/                  # Modular Prisma schemas
│   │   ├── base.prisma             # Generator & datasource config
│   │   ├── enums.prisma            # All enums
│   │   ├── auth.prisma             # AuthUser, AuthSecurity models
│   │   ├── profile.prisma          # UserProfile model
│   │   ├── history.prisma          # LoginHistory, EmailHistory
│   │   ├── activityLog.prisma      # Activity logging
│   │   └── subscription.prisma     # Subscription, Payment, Invoice
│   └── 📂 migrations/              # Database migrations
│
├── 📂 monitoring/
│   ├── 📂 prometheus/              # Prometheus config
│   ├── 📂 grafana/                 # Grafana provisioning
│   └── 📂 loki/                    # Loki configuration
│
├── 📂 templates/
│   └── 📂 emails/                  # Email HTML templates
│
├── 📂 test/                        # E2E tests
├── docker-compose.yaml             # Development services
├── docker-compose.prod.yaml        # Production backend
├── docker-compose.override.yaml    # Development overrides
├── Dockerfile                      # Multi-stage build
├── .env.example                    # Environment template
└── postman-collection.json         # API collection
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 22
- **npm** ≥ 10
- **Docker** & **Docker Compose**
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/the-pujon/nestjs-prisma-postgres-starter.git
   cd nestjs-prisma-postgres-starter
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Update `.env`** with your configuration (see [Environment Configuration](#-environment-configuration))

4. **Start Docker services**
   ```bash
   # Start all services (PostgreSQL, Redis, Prometheus, Grafana, Loki)
   docker compose up -d
   ```

5. **Install dependencies**
   ```bash
   npm install
   ```

6. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```

7. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

7. **Start the application**
   ```bash
   # Development mode with hot reload
   npm run start:dev
   
   # Or production mode
   npm run build && npm run start:prod
   ```

8. **Verify installation**
   - API: http://localhost:5000
   - PgAdmin: http://localhost:8080
   - RedisInsight: http://localhost:8001
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3000
   - Loki: http://localhost:3100

---

## ⚙️ Environment Configuration

Create a `.env` file based on `.env.example`:

```env
# ═══════════════════════════════════════════════════════════════
# DATABASE CONFIGURATION
# ═══════════════════════════════════════════════════════════════
DATABASE_URL=postgresql://admin:admin@127.0.0.1:5433/simple_blog
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin
POSTGRES_DB=simple_blog
DATABASE_PORT=5433
DATABASE_HOST=127.0.0.1

# ═══════════════════════════════════════════════════════════════
# APPLICATION CONFIGURATION
# ═══════════════════════════════════════════════════════════════
NODE_ENV=development
PORT=5000

# ═══════════════════════════════════════════════════════════════
# JWT CONFIGURATION
# ═══════════════════════════════════════════════════════════════
# IMPORTANT: Use a strong, random secret (at least 256 bits)
# Generate with: openssl rand -base64 32
JWT_SECRET=a-string-secret-at-least-256-bits-long

# ═══════════════════════════════════════════════════════════════
# REDIS CONFIGURATION
# ═══════════════════════════════════════════════════════════════
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USER=default
REDIS_PASSWORD=your_redis_password

# ═══════════════════════════════════════════════════════════════
# EMAIL CONFIGURATION (Gmail SMTP)
# ═══════════════════════════════════════════════════════════════
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password           # Use Gmail App Password
EMAIL_FROM=noreply@yourapp.com

# ═══════════════════════════════════════════════════════════════
# GOOGLE OAUTH (Optional)
# ═══════════════════════════════════════════════════════════════
# Get credentials: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback

# ═══════════════════════════════════════════════════════════════
# PGADMIN CONFIGURATION
# ═══════════════════════════════════════════════════════════════
PGADMIN_DEFAULT_EMAIL=admin@example.com
PGADMIN_DEFAULT_PASSWORD=admin

# ═══════════════════════════════════════════════════════════════
# MONITORING CONFIGURATION
# ═══════════════════════════════════════════════════════════════
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
LOKI_ENABLED=true
LOKI_URL=http://localhost:3100
```

### Gmail App Password Setup

1. Enable 2-Factor Authentication on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Generate a new app password for "Mail"
4. Use this password in `EMAIL_PASS`

---


## 📡 API Reference

### Response Format

All API responses follow a consistent format:

```json
// Success Response
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2024-01-29T12:00:00.000Z"
}

// Error Response
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": { ... }
  },
  "timestamp": "2024-01-29T12:00:00.000Z"
}
```

### Postman Collection

Import `postman-collection.json` into Postman for a complete API testing environment with examples.

### Example Requests

#### Register User
```bash
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "username": "johndoe"
  }'
```

#### Login
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

#### Protected Route
```bash
curl -X GET http://localhost:5000/user/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🐳 Docker Setup

### Development

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove volumes (reset data)
docker compose down -v
```

### Services Overview

| Service | Port | Description |
|---------|------|-------------|
| `postgres_db` | 5433 | PostgreSQL database |
| `pg_admin` | 8080, 8443 | PgAdmin web interface |
| `redis_cache` | 6379, 8001 | Redis Stack with RedisInsight |
| `prometheus` | 9090 | Metrics collection |
| `grafana` | 3000 | Visualization dashboards |
| `loki` | 3100 | Log aggregation |

### Dockerfile (Multi-stage Build)

The Dockerfile uses a multi-stage build for optimized production images:

```dockerfile
# Build Stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Runtime Stage (smaller image)
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/src/main.js"]
```

---

## 📊 Monitoring Stack

### Prometheus Metrics

Access metrics at: http://localhost:5000/metrics

**Available Metrics:**
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_total` - Total request count by method/route/status
- `http_request_errors_total` - Error count by type
- `active_users_total` - Currently active users
- Default Node.js metrics (CPU, memory, event loop)

### Grafana Dashboards

1. Access Grafana at http://localhost:3000
2. Login with `admin/admin` (or your configured credentials)
3. Data sources (Prometheus, Loki) are auto-provisioned

### Loki Logging

Winston automatically sends logs to Loki with labels:
- `app: nestjs-app`
- `environment: development|production`

Query logs in Grafana with LogQL:
```logql
{app="nestjs-app"} |= "error"
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The workflow (`.github/workflows/deploy.yaml`) automates deployment to EC2:

```yaml
name: CI/CD Deploy to EC2

on:
  push:
    branches:
      - deploy

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build Docker Image
        run: docker build -t your-username/app-name:latest .

      - name: Push Docker Image
        run: docker push your-username/app-name:latest

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v0.1.6
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ec2-user/my-app
            docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml pull
            docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub access token |
| `EC2_HOST` | EC2 public IP or domain |
| `EC2_USER` | EC2 SSH username (e.g., `ec2-user`) |
| `EC2_SSH_KEY` | Private SSH key for EC2 |

---

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

### Test Structure

```
src/
├── auth/
│   ├── auth.controller.spec.ts    # Controller tests
│   └── auth.service.spec.ts       # Service tests
├── user/
│   ├── user.controller.spec.ts
│   └── user.service.spec.ts
└── app.controller.spec.ts

test/
├── app.e2e-spec.ts                # End-to-end tests
└── jest-e2e.json                  # E2E Jest config
```

---

## 🚀 Production Deployment

### 1. EC2 Setup

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install Docker
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create app directory
mkdir -p /home/ec2-user/my-app
cd /home/ec2-user/my-app
```

### 2. Production Environment

Create `.env` on server with production values:
- Use strong, unique `JWT_SECRET`
- Set `NODE_ENV=production`
- Configure production database credentials
- Set up proper email configuration

### 3. Deploy

```bash
# Copy docker-compose files to server
scp docker-compose.yaml docker-compose.prod.yaml ec2-user@server:/home/ec2-user/my-app/

# Pull and run
docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml pull
docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d

# Run migrations
docker exec -it simple_blog_backend npx prisma migrate deploy
```

### 4. SSL/TLS (Recommended)

Use a reverse proxy (Nginx, Caddy) or AWS ALB for SSL termination.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style

- Follow ESLint configuration
- Use Prettier for formatting
- Write tests for new features
- Update documentation as needed

---

## 📄 License

This project is [MIT licensed](LICENSE).

---

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/) - The progressive Node.js framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [PostgreSQL](https://www.postgresql.org/) - The world's most advanced open source database

---

<p align="center">Made with ❤️ by <a href="https://github.com/the-pujon">Pujon Das Auvi</a></p>
