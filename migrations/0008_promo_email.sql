-- Rebuild only to extend the existing delivery CHECK constraint. Preserve every
-- registration/code; never backfill delivery or resend legacy registrations.
CREATE TABLE promo_signups_email (
  email TEXT NOT NULL PRIMARY KEY COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sending', 'sent', 'failed')),
  promotion_request_id TEXT,
  stripe_promotion_code_id TEXT,
  promotion_code TEXT,
  email_sent_at TEXT,
  CHECK (email = lower(trim(email)) COLLATE BINARY AND length(email) BETWEEN 3 AND 254)
);
INSERT INTO promo_signups_email
  (email, created_at, delivery_status, promotion_request_id, stripe_promotion_code_id, promotion_code)
SELECT email, created_at, delivery_status, promotion_request_id, stripe_promotion_code_id, promotion_code
FROM promo_signups;
DROP TABLE promo_signups;
ALTER TABLE promo_signups_email RENAME TO promo_signups;
CREATE UNIQUE INDEX promo_signups_request_id ON promo_signups(promotion_request_id);
CREATE UNIQUE INDEX promo_signups_stripe_code_id ON promo_signups(stripe_promotion_code_id);
CREATE UNIQUE INDEX promo_signups_code ON promo_signups(promotion_code COLLATE NOCASE);
