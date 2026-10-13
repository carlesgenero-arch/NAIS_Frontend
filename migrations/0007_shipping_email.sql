ALTER TABLE orders ADD COLUMN shipping_email_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (shipping_email_status IN ('pending', 'sending', 'sent', 'failed', 'skipped'));
ALTER TABLE orders ADD COLUMN shipping_email_sent_at TEXT;
-- Do not send historical shipments. Existing pending/preparing orders remain eligible.
UPDATE orders SET shipping_email_status='skipped'
  WHERE fulfillment_status IN ('shipped', 'delivered', 'cancelled');
