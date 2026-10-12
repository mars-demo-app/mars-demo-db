-- Baseline schema for Mars Demo Shop (managed Postgres on App Platform).
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  customer_email TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);

-- Seed a hot-path email used by the UI "Slow lookup" action.
INSERT INTO orders (customer_email, amount_cents, status)
SELECT 'hotpath@example.com', 2500, 'created'
WHERE NOT EXISTS (
  SELECT 1 FROM orders WHERE customer_email = 'hotpath@example.com'
);
