ALTER TABLE orders ADD COLUMN confirmation_email_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (confirmation_email_status IN ('pending', 'sending', 'sent', 'failed', 'skipped'));
ALTER TABLE orders ADD COLUMN confirmation_email_sent_at TEXT;
-- Do not send a backlog of historical confirmations on webhook replay.
UPDATE orders SET confirmation_email_status = 'skipped';
