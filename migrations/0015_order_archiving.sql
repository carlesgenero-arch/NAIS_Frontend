-- Archival is independent of payment and fulfillment. Preserve all existing rows.
ALTER TABLE orders ADD COLUMN archived_at TEXT;
CREATE INDEX idx_orders_archive_created ON orders(archived_at, created_at DESC, id DESC);
