# mars-demo-db

Relational schema and migrations that control the **managed Postgres** database attached to the Mars Demo Shop App Platform app.

## Role in the app

| Concern | Detail |
| --- | --- |
| Database component | `databases.db` in [`mars-demo-app/.do/app.yaml`](https://github.com/hugocorbucci/mars-demo-app/blob/main/.do/app.yaml) (`engine: PG`) |
| How schema is applied | App Platform `PRE_DEPLOY` job `db-migrate` runs `npm run migrate` from **this repo** with `${db.DATABASE_URL}` |
| Consumers | [`mars-demo-api`](https://github.com/hugocorbucci/mars-demo-api) reads/writes `orders` |

This is the customer-like separation: the app spec provisions/attaches the managed DB; this repo owns DDL; the API does not embed schema ownership.

## Layout

```
migrations/
  001_init.sql                      # orders table + created_at index
  002_latent_missing_index_note.sql # documents intentional missing email index
scripts/migrate.js                  # applies *.sql in order, tracks schema_migrations
```

## Local apply

```bash
npm install
export DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/mars_demo'
export PGSSL=disable
npm run migrate
```

## Managed-DB tie-in story

1. `mars-demo-app` declares `databases: [{ name: db, engine: PG, … }]`.
2. App Platform injects bindable vars such as `${db.DATABASE_URL}`.
3. The `db-migrate` job (this repo) runs before each deploy and applies pending SQL.
4. The `api` service uses the same `DATABASE_URL` at runtime.
