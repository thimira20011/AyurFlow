# AyurFlow

Initial project scaffold for the single-clinic Ayurvedic pilot described in the supplied proposal, SRS v1.0 and team task plan (1 October 2026).

**Status:** starter infrastructure and module pages only. Authentication, patient registration and the clinical-to-receipt workflow are not implemented. No real patient data or default staff passwords are included.

## Project layout

```text
AyurFlow/
├── backend/
│   ├── cmd/api/                 Go/Gin server entry point
│   ├── cmd/migrate/             Forward migration command
│   ├── db/migrations/           Numbered PostgreSQL SQL migrations
│   ├── db/seeds/                Synthetic seed implementation area
│   └── internal/
│       ├── auth/                Staff identity and server sessions
│       ├── patients/            Registration, consultations and addenda
│       ├── clinical/            Ordered pathway and clinician decisions
│       ├── scheduling/          Rooms, availability and session delivery
│       ├── inventory/           Batches, recipes, preparation and traceability
│       ├── billing/             Invoices, deposits and receipts
│       ├── administration/      Users, roles and reference data
│       ├── audit/               Transactional critical-event recording
│       ├── reports/             Restricted operational reports
│       ├── config/              Environment configuration
│       ├── platform/database/   pgx connection pool
│       └── transport/http/      Versioned routing and API errors
├── frontend/
│   ├── src/app/                 Next.js App Router and six module routes
│   ├── src/components/          Shared interface components
│   ├── src/features/            Per-module interface implementation areas
│   ├── src/lib/                 API client, navigation and formatting
│   └── public/                  Public static assets
├── docs/                       Architecture, decisions, tasks and verification
├── deploy/                     HTTPS reverse proxy template
├── scripts/                    Local check commands
├── tests/                      Integration, acceptance and synthetic fixtures
├── .github/workflows/          Go and frontend CI checks
└── compose.yaml                Development database, migration, API and UI
```

The backend uses handlers, services and repositories within each module as features are introduced. Go owns business rules and transactions. Next.js calls `/api/v1`; it has no database connection.

## Start with Docker

Install Docker Engine/Desktop with Compose. From the project root:

```powershell
Copy-Item .env.example .env
# Edit .env and set POSTGRES_PASSWORD. Use a URL-safe development password.
docker compose up --build -d
docker compose logs migrate backend frontend
```

Open <http://localhost:3000>. API liveness: <http://localhost:8080/api/v1/health>; database readiness: <http://localhost:8080/api/v1/ready>. Compose waits for the database and migration job before starting the API. Persistent data lives in the `postgres_data` volume.

This Compose file binds application/database ports to localhost for development. The pilot HTTPS proxy is a template, not a completed production deployment. See [operations](docs/operations.md).

## Start Go and Next.js locally

Use Go 1.27.1 and Node.js 22.23.2. Start PostgreSQL using `docker compose up -d db` or your own PostgreSQL 17 installation. Create the `.env` file first if using Compose.

Backend, in one PowerShell terminal:

```powershell
Set-Location backend
$env:DATABASE_URL = 'postgres://ayurflow:YOUR_PASSWORD@localhost:5432/ayurflow?sslmode=disable'
go mod download
go run ./cmd/migrate
go run ./cmd/api
```

Frontend, in a second terminal:

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Go reads environment variables directly; it does not load `.env` files automatically. Next.js reads `frontend/.env.local`. URL-encode credentials in `DATABASE_URL` when using reserved characters.

## Checks and next implementation work

Run `./scripts/check.ps1`, or run Go format/vet/test/build from `backend/` and frontend lint/typecheck/build from `frontend/`. Dependency resolution is captured in `go.sum` and `package-lock.json`.

Start Sprint 1 with the pending decision register, authentication/permissions/CSRF, and patient registration. The first exit check is a deployed login-to-registration-to-search journey. Module folders and pages currently establish boundaries; they do not satisfy the SRS acceptance tests.

See [architecture](docs/architecture.md), [OpenAPI](docs/api/openapi.yaml), [team allocation](docs/team-plan.md), [decisions](docs/decisions.md), [testing](docs/testing.md) and [contributing](CONTRIBUTING.md).
