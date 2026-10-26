"use strict";

/**
 * Insert bulk + hotpath sample orders for local / load prep.
 *
 * Usage:
 *   DATABASE_URL=... PGSSL=disable npm run seed
 *   COUNT=100000 HOTPATH_EXTRA=300 npm run seed
 */

const { Pool } = require("pg");

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return "";
}

function poolConfig(url) {
  if (process.env.PGSSL === "disable") {
    return { connectionString: url, ssl: false, connectionTimeoutMillis: 30_000 };
  }
  let cleaned = url;
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("uselibpqcompat");
    cleaned = u.toString();
  } catch {
    cleaned = url;
  }
  return {
    connectionString: cleaned,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
  };
}

async function main() {
  const url = buildDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const count = Math.min(
    500_000,
    Math.max(1, Math.floor(Number(process.env.COUNT || 80_000)))
  );
  const hotpathExtra = Math.min(
    10_000,
    Math.max(0, Math.floor(Number(process.env.HOTPATH_EXTRA || 200)))
  );
  const hotpath = (process.env.HOTPATH_EMAIL || "hotpath@example.com").toLowerCase();

  const pool = new Pool(poolConfig(url));
  const client = await pool.connect();
  try {
    const before = await client.query("SELECT COUNT(*)::bigint AS n FROM orders");
    console.log(`orders before: ${before.rows[0].n}`);
    console.log(`inserting ${count} bulk rows + ${hotpathExtra} hotpath rows…`);
    const started = Date.now();
    await client.query(
      `INSERT INTO orders (customer_email, amount_cents, status)
       SELECT
         'bulk-' || g::text || '@example.com',
         500 + (g % 5000),
         'created'
       FROM generate_series(1, $1) AS g`,
      [count]
    );
    if (hotpathExtra > 0) {
      await client.query(
        `INSERT INTO orders (customer_email, amount_cents, status)
         SELECT $1, 2500 + (g % 100), 'created'
         FROM generate_series(1, $2) AS g`,
        [hotpath, hotpathExtra]
      );
    }
    const after = await client.query("SELECT COUNT(*)::bigint AS n FROM orders");
    console.log(`orders after: ${after.rows[0].n} (${Date.now() - started}ms)`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
