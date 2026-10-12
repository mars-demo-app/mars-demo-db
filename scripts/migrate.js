"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const migrationsDir = path.join(__dirname, "..", "migrations");
const MAX_ATTEMPTS = Number(process.env.MIGRATE_CONNECT_ATTEMPTS || 30);
const RETRY_MS = Number(process.env.MIGRATE_CONNECT_RETRY_MS || 2000);

function safeDbHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

function poolConfig() {
  return {
    connectionString: DATABASE_URL,
    // App Platform managed PG needs TLS; local Make sets PGSSL=disable.
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  };
}

async function connectWithRetry() {
  const pool = new Pool(poolConfig());
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = await pool.connect();
      console.log(
        `connected to ${safeDbHost(DATABASE_URL)} (attempt ${attempt}/${MAX_ATTEMPTS})`
      );
      return { pool, client };
    } catch (err) {
      lastErr = err;
      console.error(
        `connect attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`
      );
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_MS));
      }
    }
  }
  await pool.end().catch(() => {});
  throw lastErr;
}

async function main() {
  console.log(`mars-demo-db migrate → ${safeDbHost(DATABASE_URL)}`);
  const { pool, client } = await connectWithRetry();
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
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [
          file,
        ]);
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
