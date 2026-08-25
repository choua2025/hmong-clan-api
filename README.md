# Vang Clan (Xeem Vaj) Association — Backend

Express + TypeScript + Prisma API for the single-clan association management
system. See the project brief in [`../claude.md`](../claude.md) for the full
domain model and conventions.

## Architecture

Layered, one folder per domain under `src/modules/<domain>`:

- **repository** — Prisma data access only (no business rules).
- **service** — business logic, role scoping, transactions.
- **controller** — thin HTTP glue (request → service → response).
- **routes** — wiring, auth/role guards, and zod validation.

Cross-cutting code lives in `src/config`, `src/lib`, `src/middleware`, and
`src/utils`.

### Key conventions (from the brief)

- All money is `Decimal(12,2)` — never `Float`. See `utils/validators.ts`.
- Names stored bilingually (Hmong + Lao/English).
- Single clan: **no Clan/SubClan tables**. Hierarchy is Household → Members.
- Dues are charged **per household**.
- Data is scoped by role: a `MEMBER` only sees their own household; `TREASURER`
  confirms payments; `LEADER` manages households/members; `SUPER_ADMIN` does
  everything. See `utils/scope.ts`.
- OCR/QR slip values are **advisory** — a treasurer confirms the real amount
  before money is recorded.

## Getting started

```bash
cd backend
cp .env.example .env          # then fill in DATABASE_URL and JWT secrets
npm install
npm run prisma:generate
npm run prisma:migrate        # creates the schema in PostgreSQL
npm run db:seed               # optional: super admin + sample data
npm run dev                   # http://localhost:4000
```

### With Docker

Brings up PostgreSQL, applies migrations, then starts the API with hot reload:

```bash
docker compose up                  # API on http://localhost:4000
docker compose run --rm seed       # optional: sample data
docker compose down -v             # stop and wipe the database volume
```

Host ports are overridable when something already owns them —
`API_PORT=4200 docker compose up`. The database is published on **5433** by
default to avoid clashing with a locally-installed PostgreSQL on 5432.

The `prod` target (compiled `dist/`, production deps, non-root) is what ships:
Render builds this same Dockerfile, so `docker build --target prod .` gives
you the production image locally. Keep `prod` as the final stage — Render
builds whatever stage comes last. See [DEPLOYMENT.md](DEPLOYMENT.md).

Health check: `GET /api/health`. On Render it also reports the deployed commit
SHA, so you can confirm which build is live.

Deployment is automated — see [DEPLOYMENT.md](DEPLOYMENT.md) for the pipeline
and the one-time Render setup.

Seeded development logins:

- Super admin: `admin@vangclan.local` / `ChangeMe123!`
- Linked member: `member@vangclan.local` / `Member123!`

Self-registered accounts are inactive until a SUPER_ADMIN verifies them from
Pending Accounts. That approval can also link the user to an existing member.

## API surface (this pass)

| Method | Path                      | Role            | Purpose                                   |
| ------ | ------------------------- | --------------- | ----------------------------------------- |
| POST   | `/api/auth/signup`        | public          | Self-register → PENDING account (no token)|
| POST   | `/api/auth/login`         | public          | Log in, get access + refresh tokens       |
| POST   | `/api/auth/refresh`       | public          | Rotate tokens                             |
| POST   | `/api/auth/forgot-password`| public         | Request a password-reset token            |
| POST   | `/api/auth/reset-password`| public          | Set a new password with the token         |
| POST   | `/api/auth/logout`        | auth            | Invalidate refresh token                  |
| GET    | `/api/auth/me`            | auth            | Current user                              |
| GET    | `/api/auth/pending-users` | SUPER_ADMIN     | List accounts awaiting verification       |
| POST   | `/api/auth/pending-users/:id/verify`| SUPER_ADMIN| Activate (and optionally link member)     |
| GET    | `/api/households`         | auth (scoped)   | List households                           |
| POST   | `/api/households`         | LEADER          | Create household                          |
| GET    | `/api/households/:id`     | auth (scoped)   | Household detail                          |
| PATCH  | `/api/households/:id`     | LEADER          | Update / set head                         |
| DELETE | `/api/households/:id`     | LEADER          | Delete household                          |
| GET    | `/api/members`            | auth (scoped)   | List members                              |
| POST   | `/api/members`            | LEADER          | Register member                           |
| GET    | `/api/members/:id`        | auth (scoped)   | Member detail                             |
| PATCH  | `/api/members/:id`        | LEADER          | Update member                             |
| DELETE | `/api/members/:id`        | LEADER          | Delete member                             |
| GET    | `/api/dues`               | auth (scoped)   | List dues                                 |
| POST   | `/api/dues`               | TREASURER       | Charge a household for a period           |
| GET    | `/api/dues/:id`           | auth (scoped)   | Dues detail                               |
| POST   | `/api/dues/:id/pay`       | auth (scoped)   | Submit transfer slip (creates Payment)    |
| POST   | `/api/dues/:id/confirm`   | TREASURER       | Confirm human-verified amount → PAID      |
| POST   | `/api/dues/:id/reject`    | TREASURER       | Reject payment → back to UNPAID           |
| GET    | `/api/payments`           | TREASURER       | List payments (filter by status)          |
| GET    | `/api/payments/:id`       | TREASURER       | Payment detail + what it settles          |
| POST   | `/api/payments/:id/confirm`| TREASURER      | Confirm any payment (verified amount)     |
| POST   | `/api/payments/:id/reject`| TREASURER       | Reject any payment                        |
| GET    | `/api/donations`          | auth (scoped)   | List donations                            |
| POST   | `/api/donations`          | auth (scoped)   | Record a donation (creates PENDING payment)|
| GET    | `/api/donations/:id`      | auth (scoped)   | Donation detail                           |
| GET    | `/api/aid-cases`          | auth            | List mutual-aid cases                     |
| POST   | `/api/aid-cases`          | LEADER          | Open a mutual-aid case                    |
| GET    | `/api/aid-cases/:id`      | auth            | Case detail + confirmed total + givers    |
| POST   | `/api/aid-cases/:id/close`| LEADER          | Close a case                              |
| POST   | `/api/aid-cases/:id/contributions`| auth (scoped)| Contribute (creates PENDING payment)  |
| GET    | `/api/events`             | auth            | List events (filter type, upcoming)       |
| POST   | `/api/events`             | LEADER          | Create event                              |
| GET    | `/api/events/:id`         | auth            | Event detail + attendees                  |
| PATCH  | `/api/events/:id`         | LEADER          | Update event                              |
| DELETE | `/api/events/:id`         | LEADER          | Delete event                              |
| POST   | `/api/events/:id/rsvp`    | auth (member)   | RSVP for self (GOING/DECLINED)            |
| POST   | `/api/events/:id/attendees`| LEADER         | Add attendee / mark ATTENDED              |
| GET    | `/api/announcements`      | auth            | List (members see published only)         |
| POST   | `/api/announcements`      | LEADER          | Create (optionally publish)               |
| GET    | `/api/announcements/:id`  | auth            | Announcement detail                       |
| PATCH  | `/api/announcements/:id`  | LEADER          | Update / publish / pin                    |
| DELETE | `/api/announcements/:id`  | LEADER          | Delete                                    |
| GET    | `/api/documents`          | auth            | List shared documents                     |
| POST   | `/api/documents`          | LEADER          | Add a document (bylaws, minutes)          |
| GET    | `/api/documents/:id`      | auth            | Document detail                           |
| PATCH  | `/api/documents/:id`      | LEADER          | Update                                    |
| DELETE | `/api/documents/:id`      | LEADER          | Delete                                    |

Authenticate with `Authorization: Bearer <accessToken>`.

Donations and aid contributions settle through the shared `Payment` record, so
a treasurer confirms them via `POST /api/payments/:id/confirm` (or rejects via
`/reject`) — the same human-verified flow as dues.

## Dues lifecycle (the central flow)

```
UNPAID ──(member uploads slip /pay)──▶ PENDING ──(treasurer /confirm)──▶ PAID
   ▲                                       │
   └──────────(treasurer /reject)──────────┘
```

A `Payment` row backs each submission. Its `ocrAmount`/`ocrRaw` come from QR/OCR
scanning and are never trusted; the treasurer's confirmed `amount` is
authoritative.

## Not yet built

Frontend (Nuxt 3), file-upload integration (Cloudinary/local disk), and QR+OCR
slip scanning. All domain endpoints from the schema now exist; uploads currently
accept a `slipUrl`/`fileUrl` string, so wiring real file storage + OCR is the
remaining backend work.
