-- Independent internal delivery state. Never notify a backlog on webhook replay.
ALTER TABLE orders ADD COLUMN notification_email_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (notification_email_status IN ('pending', 'sending', 'sent', 'failed', 'skipped'));
ALTER TABLE orders ADD COLUMN notification_email_sent_at TEXT;
UPDATE orders SET notification_email_status='skipped';
