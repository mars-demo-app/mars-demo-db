-- OPTIONAL FIX (not applied on main).
-- Copy/rename to 003_add_customer_email_index.sql on a demo/fix branch when
-- showing the remediation for the missing-index congestion scenario.
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction; the migrate.js
-- runner wraps each file in BEGIN/COMMIT, so use a plain CREATE INDEX here
-- for the demo (acceptable on a small/medium table during a live demo).

CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders (customer_email);
