-- Extend status semantics without changing prices, Stripe mappings or historical order snapshots.
CREATE TABLE products_with_sold_out (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('active', 'sold-out', 'coming-soon', 'draft', 'archived')),
  price_cents INTEGER NOT NULL
    CHECK (typeof(price_cents) = 'integer' AND price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'eur',
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  image_url TEXT,
  feature_image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO products_with_sold_out (id, slug, name, description, status, price_cents, currency, stripe_product_id, stripe_price_id, image_url, feature_image_url, created_at, updated_at)
SELECT id, slug, name, description, status, price_cents, currency, stripe_product_id, stripe_price_id, image_url, feature_image_url, created_at, updated_at FROM products;
DROP TABLE products;
ALTER TABLE products_with_sold_out RENAME TO products;
CREATE INDEX idx_products_status ON products(status);

UPDATE products SET status = 'sold-out', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'tropical-hops-harvest' AND status = 'coming-soon';
