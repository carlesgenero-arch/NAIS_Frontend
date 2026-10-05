-- Additive: preserve existing signups and delivery status. No automatic backfill.
ALTER TABLE promo_signups ADD COLUMN promotion_request_id TEXT;
ALTER TABLE promo_signups ADD COLUMN stripe_promotion_code_id TEXT;
ALTER TABLE promo_signups ADD COLUMN promotion_code TEXT;

CREATE UNIQUE INDEX promo_signups_request_id ON promo_signups(promotion_request_id);
CREATE UNIQUE INDEX promo_signups_stripe_code_id ON promo_signups(stripe_promotion_code_id);
CREATE UNIQUE INDEX promo_signups_code ON promo_signups(promotion_code COLLATE NOCASE);
