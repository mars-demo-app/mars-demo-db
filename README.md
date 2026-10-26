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
  002_noop.sql
scripts/migrate.js
scripts/seed-orders.js
```

## Local apply

From the parent checkout (preferred):

```bash
make db-up && make migrate
make seed          # ~80k sample rows
```

Or in this repo:

```bash
npm ci
export DATABASE_URL='postgres://mars:mars@127.0.0.1:5432/mars_demo'
export PGSSL=disable
npm run migrate
COUNT=80000 npm run seed
```

On the live app, prefer the UI **Load sample orders** button (or `POST /api/demo/seed-orders`) so you do not need a direct `DATABASE_URL` from your laptop.

## App Platform / CI migrate

Workflow **`migrate`** targets GitHub Environment named after the App Platform app id:

| Environment name | App |
| --- | --- |
| `72bf7269-89cb-4719-ab44-548b972de291` | App Platform app `mars-demo` (tor) |

| Secret (on that Environment) | Purpose |
| --- | --- |
| **`DATABASE_URL`** | Managed Postgres connection string for that app’s `db` |

Set the secret once from the App Platform DB connection string (doctl / console). Then:

```bash
gh workflow run migrate --repo mars-demo-app/mars-demo-db
```

## Notes

- Migrations are plain SQL files applied in lexicographic order by `scripts/migrate.js`.
- Optional index migration stays off `main` until you deliberately enable it on a branch.
