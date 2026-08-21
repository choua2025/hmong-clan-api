# Deployment — CI/CD to Render

Production is the Render web service `hmong-clan-api`, backed by a Supabase
Postgres database. The pipeline lives in
[.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml).

## How it works

```
push / PR to main
   │
   ├─ ci job (always)
   │    npm ci → prisma validate → typecheck → build
   │    → smoke test: assemble the app, serve GET /api/health
   │
   └─ deploy job (push to main only, needs: ci)
        POST Render deploy hook
        → poll /api/health until .commit === the pushed SHA
```

CI runs **without a database**. The smoke test uses `createApp()`, which
wires up Express and the routes but never connects to Postgres, so it catches
broken imports, bad route wiring and missing env vars without needing one.

Render's own auto-deploy is **off** (`autoDeploy: false` in `render.yaml`).
The only thing that deploys production is the `deploy` job, and it never runs
unless `ci` is green — so a build that fails typecheck, has an invalid schema,
or cannot assemble will not reach the live service.

The `deploy` job does not merely check that the service answers. Render
injects `RENDER_GIT_COMMIT` into the running process, `/api/health` echoes it
back, and CI waits until that value equals the SHA it just deployed. That
distinguishes "the new build is live" from "the old instance is still
answering", which a plain health check cannot do.

## One-time setup

### 1. Render — turn off auto-deploy

`autoDeploy: false` only applies to services created from the blueprint. For
an existing service, set it in the dashboard:

**Render → hmong-clan-api → Settings → Build & Deploy → Auto-Deploy → No.**

If you skip this, pushes deploy twice: once from Render's own trigger
(ungated) and once from CI.

### 2. Render — create the deploy hook

**Settings → Deploy Hook → copy the URL.** It looks like:

```
https://api.render.com/deploy/srv-XXXXXXXX?key=YYYYYYYY
```

Treat it as a secret — anyone holding it can deploy.

### 3. GitHub — add the secret and variable

Repo → **Settings → Secrets and variables → Actions**:

| Kind     | Name                     | Value                                        |
| -------- | ------------------------ | -------------------------------------------- |
| Secret   | `RENDER_DEPLOY_HOOK_URL` | the deploy hook URL from step 2               |
| Variable | `RENDER_SERVICE_URL`     | `https://hmong-clan-api.onrender.com` (no trailing slash) |

`RENDER_SERVICE_URL` is a *variable*, not a secret — the deploy job prints it
and uses it as the environment URL. If it were a secret the logs would be
masked and unreadable.

### 4. GitHub — protect main (recommended)

**Settings → Branches → add rule for `main` → Require status checks →
select `Verify`.** This stops a red PR from being merged in the first place,
rather than catching it after the fact.

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

## Node version

`.node-version` pins Node 22 for both Render and CI, so the two build on the
same runtime. Change it in one place and both follow.

## Migrations

Migrations run in Render's **build** command (`npx prisma migrate deploy`),
against the real Supabase database.

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

## Rolling back

The deploy hook always builds the tracked branch, so rollback is
**Render → Deploys → the last good deploy → Rollback**, or revert the commit
on `main` and let the pipeline deploy the revert.

## Troubleshooting

**Deploy job times out after 15 minutes.** The hook fired but the new commit
never went live. Check Render's build logs — usually a failed
`migrate deploy` or a missing env var. The old instance is still up.

**Health check unreachable during polling.** Normal for the first attempts on
the free plan; a cold instance can take ~50s to wake. The poll allows 60
attempts at 15s intervals.

**`.commit` reads `local`.** `RENDER_GIT_COMMIT` was not present, meaning the
process is not running on Render.

**VS Code flags `environment: production` as invalid.** The GitHub Actions
extension checks environment names against those that already exist on the
repo. GitHub creates the `production` environment automatically on the first
deploy, after which the warning goes away. It is not a workflow error.
