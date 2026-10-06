CREATE TABLE products (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('active', 'coming-soon', 'draft', 'archived')),
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

-- The UNIQUE constraint already creates an index on slug.
CREATE INDEX idx_products_status ON products(status);

-- Future update operations must also set updated_at; its default is insert-only.
