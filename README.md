# mars-demo-db

Relational schema, migrations, and the **App Platform database fragment** for the Mars Demo Shop managed Postgres.

## Role in the app

| Concern | Detail |
| --- | --- |
| Database component | `databases.db` in [`.do/component.yaml`](.do/component.yaml) (merged into parent `.do/app.yaml`) |
| How schema is applied | GitHub Actions workflow **`migrate`** (`npm run migrate`) using secret `DATABASE_URL` |
| Local | From parent: `make migrate` (or here with `PGSSL=disable`) |
| Consumers | [`mars-demo-api`](https://github.com/mars-demo-app/mars-demo-api) reads/writes `orders` |

This repo owns the managed-DB declaration and the DDL. App Platform no longer runs a PRE_DEPLOY migrate job.

## Layout

```
.do/component.yaml                  # databases.db only
.github/workflows/migrate.yml       # apply migrations via Actions
migrations/
  001_init.sql
  002_latent_missing_index_note.sql
scripts/migrate.js
```

## Local apply

From the parent checkout (preferred):

```bash
make db-up && make migrate
```

Or in this repo:

```bash
npm ci
export DATABASE_URL='postgres://mars:mars@127.0.0.1:5432/mars_demo'
export PGSSL=disable
npm run migrate
```

## App Platform / CI migrate

1. Deploy/update the app so managed `db` exists.
2. Copy the DB connection string from App Platform → app `mars-demo` → database `db`.
3. Add repo secret **`DATABASE_URL`** on this repository (Settings → Secrets and variables → Actions).
4. Run workflow **`migrate`** (Actions → migrate → Run workflow), or push a change under `migrations/`.

Required secret:

| Secret | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres URL for the App Platform managed `db` |

## App Platform fragment

[`.do/component.yaml`](.do/component.yaml) declares `databases` only. Parent [`mars-demo-app`](https://github.com/mars-demo-app/mars-demo-app) merges fragments into `.do/app.yaml`.

When `.do/**` changes, workflow `notify-parent-spec` can dispatch parent compose (optional secret `PARENT_DISPATCH_TOKEN`).
