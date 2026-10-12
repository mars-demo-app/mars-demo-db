# mars-demo-db

Relational schema, migrations, and the **App Platform database fragment** for the Mars Demo Shop managed Postgres.

## Role in the app

| Concern | Detail |
| --- | --- |
| Database component | `databases.db` in [`.do/component.yaml`](.do/component.yaml) (merged into parent `.do/app.yaml`) |
| How schema is applied | App Platform `PRE_DEPLOY` job `db-migrate` (same fragment) runs `npm run migrate` with `${db.DATABASE_URL}` |
| Consumers | [`mars-demo-api`](https://github.com/hugocorbucci/mars-demo-api) reads/writes `orders` |

This repo owns both the managed-DB declaration and the DDL that runs against it. The parent only composes fragments.

## Layout

```
.do/component.yaml                  # databases.db + jobs.db-migrate
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

1. This repo’s fragment declares `databases: [{ name: db, engine: PG, … }]`.
2. Parent compose merges that into `.do/app.yaml`; App Platform injects `${db.DATABASE_URL}`.
3. The `db-migrate` job (this repo) runs before each deploy and applies pending SQL.
4. The `api` service uses the same `DATABASE_URL` at runtime.

## App Platform fragment

Owned in [`.do/component.yaml`](.do/component.yaml). Parent [`mars-demo-app`](https://github.com/hugocorbucci/mars-demo-app) tracks this repo as a git submodule and merges fragments into `.do/app.yaml`.

When `.do/**` changes on `main`, workflow `notify-parent-spec` dispatches the parent's `compose-app-spec` workflow (requires secret `PARENT_DISPATCH_TOKEN`).
