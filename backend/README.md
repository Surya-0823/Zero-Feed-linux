# ZeroFeed Backend API Service

Centralized backend API service for ZeroFeed (Web, Electron desktop, and Chrome Extension clients). Built with TypeScript, Express, Prisma ORM, and PostgreSQL.

## Architecture

Follows the strict multi-client architecture outlined in `AGENTS.md`:

```text
Client (Web / Electron / Chrome Extension)
  ↓
API Route
  ↓
Controller
  ↓
Service (Business rules, subscription decisions)
  ↓
Repository (Database access)
  ↓
PostgreSQL 16 (via Prisma ORM)
```

## Features

- **Google-Only Authentication**: No email/password credential storage or password fields. Both Sign In and Sign Up are handled exclusively via Google OAuth ID tokens.
- **Stateless Bearer JWT + DB Refresh Tokens**: Compatible across Web, Electron, and Chrome Extensions via `Authorization: Bearer <token>`.
- **Authoritative Subscription Gating**: Subscription status is managed strictly on the backend.
- **Docker Compose Setup**: One-command orchestration for PostgreSQL and API services.
- **Local Dev Bypass Mode**: Test authentication immediately using `dev-mock-<email>` tokens before configuring Google Cloud Console credentials.

---

## Quick Start (Docker Compose)

### 1. Start Services

From the project root:

```bash
docker compose up -d --build
```

This starts:
- **PostgreSQL 16** on `localhost:5432`
- **ZeroFeed API** on `localhost:4000` (with live file-reload mounted)

### 2. Run Database Migrations

```bash
docker compose exec api npx prisma migrate dev --name init
```

### 3. Check Status

```bash
curl http://localhost:4000/health
```

---

## Local Development (Without Docker)

If you have a local PostgreSQL instance running:

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your local DATABASE_URL
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

---

## API Endpoints

### 1. Healthcheck

- **`GET /health`**
  - Verifies HTTP server status and PostgreSQL connection latency.

### 2. Authentication (`/api/v1/auth`)

- **`POST /api/v1/auth/google`**
  - Body: `{ "idToken": "<google_id_token>" }`
  - In local development, you can test with: `{ "idToken": "dev-mock-test@example.com" }`
  - Automatically registers new users on first sign-in with default `INACTIVE` subscription.
  - Returns: `{ user, subscription, tokens: { accessToken, refreshToken }, isNewUser }`

- **`POST /api/v1/auth/refresh`**
  - Body: `{ "refreshToken": "<refresh_token>" }`
  - Returns rotated access and refresh tokens.

- **`POST /api/v1/auth/logout`**
  - Body: `{ "refreshToken": "<refresh_token>" }`
  - Revokes refresh token in database.

- **`GET /api/v1/auth/me`**
  - Header: `Authorization: Bearer <accessToken>`
  - Returns authenticated user profile and subscription status.

### 3. Subscription (`/api/v1/subscription`)

- **`GET /api/v1/subscription`**
  - Header: `Authorization: Bearer <accessToken>`
  - Returns authoritative subscription status (`status`, `plan`, `isAccessAllowed`).

### 4. Users (`/api/v1/users`)

- **`GET /api/v1/users/me`**
  - Header: `Authorization: Bearer <accessToken>`
  - Returns current user profile.

- **`PATCH /api/v1/users/me`**
  - Header: `Authorization: Bearer <accessToken>`
  - Body: `{ "name": "...", "avatarUrl": "..." }`
  - Updates profile metadata.

### 5. Chrome Policy & Accountability Partner (`/api/v1/policy`)

- **`GET /api/v1/policy`**
  - Header: `Authorization: Bearer <accessToken>`
  - Returns current Chrome Extension policy (feed block rules, status) and accountability partner info.

- **`POST /api/v1/policy/partner`**
  - Header: `Authorization: Bearer <accessToken>`
  - Body: `{ "email": "partner@example.com", "name": "Partner Name" }`
  - Registers the user's accountability partner.

- **`POST /api/v1/policy/request-otp`**
  - Header: `Authorization: Bearer <accessToken>`
  - Body: `{ "action": "DISABLE_POLICY" }` (or `ENABLE_POLICY`, `UPDATE_RULES`)
  - Generates a 6-digit OTP and emails it to the partner's inbox (15m validity, 60s cooldown).

- **`POST /api/v1/policy/verify-otp`**
  - Header: `Authorization: Bearer <accessToken>`
  - Body: `{ "action": "DISABLE_POLICY", "otpCode": "123456" }`
  - Verifies the 6-digit OTP provided by the partner. If valid, executes the policy change and updates the database.
