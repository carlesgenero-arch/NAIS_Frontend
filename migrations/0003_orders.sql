CREATE TABLE orders (
  id TEXT PRIMARY KEY NOT NULL,

  order_number TEXT NOT NULL UNIQUE,

  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  stripe_event_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_customer_id TEXT,

  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,

  shipping_name TEXT NOT NULL,
  shipping_address_line1 TEXT NOT NULL,
  shipping_address_line2 TEXT,
  shipping_postal_code TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_country TEXT NOT NULL,

  subtotal_amount INTEGER NOT NULL
    CHECK (typeof(subtotal_amount) = 'integer' AND subtotal_amount >= 0),

  shipping_amount INTEGER NOT NULL
    CHECK (typeof(shipping_amount) = 'integer' AND shipping_amount >= 0),

  discount_amount INTEGER NOT NULL
    CHECK (typeof(discount_amount) = 'integer' AND discount_amount >= 0),

  tax_amount INTEGER NOT NULL
    CHECK (typeof(tax_amount) = 'integer' AND tax_amount >= 0),

  total_amount INTEGER NOT NULL
    CHECK (typeof(total_amount) = 'integer' AND total_amount >= 0),

  currency TEXT NOT NULL,

  payment_status TEXT NOT NULL
    CHECK (
      payment_status IN (
        'paid',
        'partially_refunded',
        'refunded'
      )
    ),

  fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      fulfillment_status IN (
        'pending',
        'preparing',
        'shipped',
        'delivered',
        'cancelled'
      )
    ),

  created_at TEXT NOT NULL DEFAULT (
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ),

  paid_at TEXT NOT NULL
);


CREATE TABLE order_items (
  id TEXT PRIMARY KEY NOT NULL,

  order_id TEXT NOT NULL
    REFERENCES orders(id)
    ON DELETE CASCADE,

  stripe_line_item_id TEXT NOT NULL,

  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,

  quantity INTEGER NOT NULL
    CHECK (typeof(quantity) = 'integer' AND quantity > 0),

  unit_amount INTEGER NOT NULL
    CHECK (typeof(unit_amount) = 'integer' AND unit_amount >= 0),

  line_total_amount INTEGER NOT NULL
    CHECK (typeof(line_total_amount) = 'integer' AND line_total_amount >= 0),

  UNIQUE(order_id, stripe_line_item_id)
);


CREATE INDEX idx_orders_fulfillment_status
  ON orders(fulfillment_status);

CREATE INDEX idx_orders_created_at
  ON orders(created_at);

CREATE INDEX idx_orders_customer_email
  ON orders(customer_email);

CREATE INDEX idx_order_items_order_id
  ON order_items(order_id);