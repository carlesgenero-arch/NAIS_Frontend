-- Durable post-commit reconciliation state; never part of the public catalogue.
ALTER TABLE products ADD COLUMN stripe_price_cleanup_ids TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(stripe_price_cleanup_ids) AND json_type(stripe_price_cleanup_ids) = 'array');
