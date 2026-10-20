-- Human-facing reference only. Legacy order_number and all identifiers remain intact.
ALTER TABLE orders ADD COLUMN order_reference TEXT;
CREATE UNIQUE INDEX orders_order_reference ON orders(order_reference);

CREATE TABLE order_reference_counters (
  year INTEGER PRIMARY KEY NOT NULL CHECK (year BETWEEN 1 AND 9999),
  sequence INTEGER NOT NULL CHECK (typeof(sequence)='integer' AND sequence > 0)
);

-- Runs only for a genuinely inserted order, inside the existing D1 batch transaction.
-- Failed child inserts roll back the counter and reference together with the order.
CREATE TRIGGER orders_assign_reference AFTER INSERT ON orders
WHEN NEW.order_reference IS NULL
BEGIN
  INSERT INTO order_reference_counters (year, sequence)
  VALUES (CAST(strftime('%Y', NEW.paid_at) AS INTEGER), 1)
  ON CONFLICT(year) DO UPDATE SET sequence=sequence+1;

  UPDATE orders
  SET order_reference = printf('NAIS-%04d-%04d',
    CAST(strftime('%Y', NEW.paid_at) AS INTEGER),
    (SELECT sequence FROM order_reference_counters
      WHERE year=CAST(strftime('%Y', NEW.paid_at) AS INTEGER)))
  WHERE id=NEW.id;
END;
