"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.db_HOSTNAME || process.env.DB_HOSTNAME || process.env.HOSTNAME;
  const port = process.env.db_PORT || process.env.DB_PORT || "5432";
  const user = process.env.db_USERNAME || process.env.DB_USERNAME || process.env.USERNAME;
  const pass = process.env.db_PASSWORD || process.env.DB_PASSWORD || process.env.PASSWORD;
  const database = process.env.db_DATABASE || process.env.DB_DATABASE || process.env.DATABASE;
  if (host && user && pass && database) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${database}?sslmode=require`;
  }
  return "";
}

const DATABASE_URL = buildDatabaseUrl();
const migrationsDir = path.join(__dirname, "..", "migrations");
const MAX_ATTEMPTS = Number(process.env.MIGRATE_CONNECT_ATTEMPTS || 40);
const RETRY_MS = Number(process.env.MIGRATE_CONNECT_RETRY_MS || 3000);

function safeDbHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable)";
  }
}

function poolConfig(url) {
  return {
    connectionString: url,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  };
}

async function connectWithRetry(url) {
  const pool = new Pool(poolConfig(url));
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = await pool.connect();
      console.log(`connected to ${safeDbHost(url)} (attempt ${attempt}/${MAX_ATTEMPTS})`);
      return { pool, client };
    } catch (err) {
      lastErr = err;
      console.error(`connect attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
  await pool.end().catch(() => {});
  throw lastErr;
}

async function main() {
  console.log("mars-demo-db migrate starting");
  console.log(
    "env: DATABASE_URL=%s db_HOSTNAME=%s DB_HOSTNAME=%s PGSSL=%s",
    process.env.DATABASE_URL ? "set" : "missing",
    process.env.db_HOSTNAME ? "set" : "missing",
    process.env.DB_HOSTNAME ? "set" : "missing",
    process.env.PGSSL || "(unset)"
  );
  // Dump bind-related keys (names only) for App Platform debugging.
  const keys = Object.keys(process.env)
    .filter((k) => /^(DATABASE|DB_|db_|PG|HOSTNAME|USERNAME|PASSWORD)/i.test(k))
    .sort();
  console.log("relevant env keys:", keys.join(", ") || "(none)");

  if (!DATABASE_URL) {
    console.error("No DATABASE_URL (or discrete db_* bind vars) available");
    process.exit(1);
  }

  console.log(`target host ${safeDbHost(DATABASE_URL)}`);
  const { pool, client } = await connectWithRetry(DATABASE_URL);
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const already = await client.query(
        "SELECT 1 FROM schema_migrations WHERE id = $1",
        [file]
      );
      if (already.rowCount) {
        console.log(`skip ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log("migrations complete");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("migrate failed:", err);
  process.exit(1);
});
