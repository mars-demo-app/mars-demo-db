-- Intentionally does NOT create an index on orders.customer_email.
-- The API's /orders/by-email path filters on that column. Under load / larger
-- tables this becomes a latent performance bug for MARS scenario 2b
-- (missing index identified after user action).
--
-- When the coding agent / MARS suggests a fix, the expected remediation is:
--   CREATE INDEX CONCURRENTLY orders_customer_email_idx ON orders (customer_email);
-- (CONCURRENTLY cannot run inside a transaction; apply out-of-band or in a later migration.)

SELECT 1;
