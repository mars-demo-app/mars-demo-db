# mars-demo-db

Relational schema, migrations, and the **App Platform database fragment** for the Mars Demo Shop managed Postgres.

## Role in the app

| Concern | Detail |
| --- | --- |
| Database component | `databases.db` in [`.do/component.yaml`](.do/component.yaml) (merged into parent `.do/app.yaml`) |
| How schema is applied | GitHub Actions workflow **`migrate`**, using Environment secret `DATABASE_URL` |
| Local | From parent: `make migrate` (or here with `PGSSL=disable`) |
| Consumers | [`mars-demo-api`](https://github.com/mars-demo-app/mars-demo-api) reads/writes `orders` |

## Layout

```
.do/component.yaml                  # databases.db only
.github/workflows/migrate.yml       # apply migrations via Actions
migrations/
  001_init.sql
  002_latent_missing_index_note.sql
  003_add_customer_email_index.sql.optional   # NOT applied on main — fix-demo only
scripts/migrate.js
scripts/seed-congestion.js
```

## Local apply

From the parent checkout (preferred):

```bash
make db-up && make migrate
make seed          # ~80k rows for missing-index congestion demo
```

Or in this repo:

```bash
npm ci
export DATABASE_URL='postgres://mars:mars@127.0.0.1:5432/mars_demo'
export PGSSL=disable
npm run migrate
COUNT=80000 npm run seed
```

On the live app, prefer the UI **Seed DB volume** button (or `POST /api/demo/seed-orders`) so you do not need a direct `DATABASE_URL` from your laptop.

**Do not** add `orders_customer_email_idx` on `main`. An optional fix PR on this repo demonstrates the remediation later.

## App Platform / CI migrate

Workflow **`migrate`** targets GitHub Environment named after the App Platform app id:

| Environment name | App |
| --- | --- |
| `72bf7269-89cb-4719-ab44-548b972de291` | App Platform app `mars-demo` (tor) |

| Secret (on that Environment) | Purpose |
| --- | --- |
| **`DATABASE_URL`** | Managed Postgres connection string for that app’s `db` |

```bash
# Manual run:
gh workflow run migrate.yml --repo mars-demo-app/mars-demo-db
```

Also runs on push to `main` when `migrations/**` (or migrate script/deps/workflow) change.


### Connectivity caveat (GitHub Actions → managed DB)

App Platform **dev** databases are typically reachable only from the app’s
trusted sources, not from public GitHub-hosted runners. A `migrate` run may
see `DATABASE_URL=set` but then fail with **connection timeout** to
`*.db.ondigitalocean.com:25060`.

Options if GHA migrate must work from GitHub:

1. Open the DB’s trusted sources to allow GitHub Actions egress (or temporarily `0.0.0.0/0` for a demo), or
2. Run migrations from a host that can already reach the DB (e.g. one-off from App Platform console / a droplet on the allowlist), or
3. Keep using schema applied by an earlier in-app migrate (current live app already has tables).

SSL: when the network path works, `migrate.js` handles DO’s `sslmode=require` /
self-signed chain the same way as the API (strip sslmode, `rejectUnauthorized: false`).
Do not set `PGSSL=disable` in Actions.

TLS: DO managed PG URLs often include `sslmode=require`. `scripts/migrate.js` strips that and uses `rejectUnauthorized: false` (same idea as the API). Do **not** set `PGSSL=disable` in Actions — that is for local Docker only.

## App Platform fragment

[`.do/component.yaml`](.do/component.yaml) declares `databases` only. Parent [`mars-demo-app`](https://github.com/mars-demo-app/mars-demo-app) merges fragments into `.do/app.yaml`.

When `.do/**` changes, workflow `notify-parent-spec` can dispatch parent compose (optional secret `PARENT_DISPATCH_TOKEN`).
