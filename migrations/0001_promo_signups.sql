-- A row grants one promotion entitlement; pending means delivery is not implemented yet.
CREATE TABLE IF NOT EXISTS promo_signups (
  email TEXT NOT NULL PRIMARY KEY COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent')),
  CHECK (email = lower(trim(email)) COLLATE BINARY AND length(email) BETWEEN 3 AND 254)
);
