# Deployment — CI/CD to Render

Production is the Render web service `hmong-clan-api`, backed by a Supabase
Postgres database. The CI pipeline lives in
[.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml).

## How it works

```
push to main
   │
   ├─ GitHub Actions
   │    "Verify"       npm ci → prisma validate → typecheck → build
   │                    → smoke test: assemble the app, serve /api/health
   │    "Docker image" docker build --target prod
   │                    → prisma CLI present? client loads? non-root?
   │
   └─ Render (Auto-Deploy: After CI Checks Pass)
        waits for BOTH checks to go green
        → docker build (same Dockerfile)
        → preDeployCommand: prisma migrate deploy
        → start container, health check /api/health
```

**Deploys are Render's job, not the workflow's.** Render watches `main`
directly, so there is no deploy step, no deploy hook, and **no GitHub secrets
or variables to configure**. The gate comes from Render's Auto-Deploy mode:
set to *After CI Checks Pass*, Render holds the deploy until every GitHub
check on that commit succeeds. A failing build never reaches the live service.

Render treats a check as passed if its conclusion is `success`, `neutral`, or
`skipped` — a **cancelled** run does not count, which is why the workflow
never cancels in-progress runs on `main`.

CI runs **without a database**. The smoke test uses `createApp()`, which wires
up Express and the routes but never connects to Postgres, so it catches broken
imports, bad route wiring and missing env vars without needing one.

## One-time setup

Just one dashboard toggle:

**Render → hmong-clan-api → Settings → Build & Deploy → Auto-Deploy →
"After CI Checks Pass".**

The three options are *On Commit* (deploys immediately, ungated),
*After CI Checks Pass* (what we want), and *Off*. If it is left on *On
Commit*, everything still deploys — just without waiting for CI, so a red
build goes live.

This setting is dashboard-only; there is no `render.yaml` field for it, which
is why `render.yaml` deliberately does not set `autoDeploy`.

### Optional: protect main

**GitHub → Settings → Branches → add rule for `main` → Require status checks
→ select `Verify`.** Stops a red PR being merged at all, rather than relying
on Render to decline the deploy afterwards.

## Environment variables

`render.yaml` declares the service's env vars. Those marked `sync: false` are
**not** stored in the repo and must be set in the Render dashboard:

- `DATABASE_URL` — the Supabase **session pooler** string (port 5432, user
  `postgres.<project-ref>`). The direct `db.<ref>.supabase.co` host is
  IPv6-only and Render cannot reach it.
- `CORS_ORIGINS` — the deployed frontend origin.
- `CLOUDINARY_URL` — leave blank to fall back to local disk.

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` use `generateValue: true`, so
Render generates them once. Rotating them logs every user out.

## The image

Render builds the repo's `Dockerfile` (`runtime: docker` in `render.yaml`),
so production runs the same image as `docker build --target prod .` locally.
There is no registry involved — Render builds from source on each deploy.

Two constraints worth knowing:

- **`prod` must remain the last stage.** Render has no blueprint field for
  choosing a build target, so it builds whatever stage comes last. A stage
  added below `prod` would silently ship to production instead.
- **The image must stay non-root-friendly.** `prisma migrate deploy` writes
  into `node_modules/@prisma/engines`, so the tree is owned by the `node`
  user. A root-owned tree fails the pre-deploy step with
  `Can't write to /app/node_modules/@prisma/engines`.

CI builds the same target and asserts both the Prisma CLI and a loadable
Linux Prisma client are present, since either missing breaks only at deploy
time.

## Node version

`.node-version` pins Node 22 for CI. The Dockerfile pins the same major via
its `NODE_VERSION` build arg — keep the two in step.

## Migrations

Migrations run as Render's **pre-deploy command** (`npx prisma migrate
deploy`), against the real Supabase database. They cannot run during the
build any more — a Docker build has no database access. The pre-deploy step
runs inside the freshly built image after the build and before traffic
shifts, so a failed migration aborts the deploy with the old instance still
serving.

**CI does not test migrations.** `prisma validate` only checks that
`schema.prisma` is well-formed — it does not execute the SQL in
`prisma/migrations/`. The first time a new migration actually runs is against
production. So before merging a migration:

- Run `npm run prisma:migrate` locally against a dev database and confirm it
  applies cleanly.
- Review destructive changes by hand (dropped columns, narrowed types, new
  `NOT NULL` without a default) — these can succeed on an empty database and
  still fail or lose data on one that holds real records.

If a migration fails during the Render build, the deploy aborts and the
previous instance keeps serving. Fix forward with a new migration; do not
edit an already-applied migration file.

If you later want migrations verified automatically, add a `postgres:16`
service container to the `ci` job and run `prisma migrate deploy` against it.

## Checking what is live

`GET /api/health` reports the running commit:

```json
{ "status": "ok", "commit": "a1b2c3d…", "time": "…" }
```

Render injects `RENDER_GIT_COMMIT`; compare it against `main` to confirm a
deploy landed. Locally the field reads `local`.

## Rolling back

**Render → Deploys → the last good deploy → Rollback**, or revert the commit
on `main` and let the pipeline deploy the revert.

## Troubleshooting

**Pushed to main but nothing deployed.** Check the Actions tab — Render is
waiting on `Verify`. A cancelled or failed run blocks the deploy by design.
Re-run the workflow once it is fixed.

**It deployed even though CI was red.** Auto-Deploy is still on *On Commit*.
Switch it to *After CI Checks Pass*.

**Health check slow to respond.** Normal on the free plan; a cold instance
can take ~50s to wake.

**`commit` reads `local`.** `RENDER_GIT_COMMIT` was not present, meaning the
process is not running on Render.
