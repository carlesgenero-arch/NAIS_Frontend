-- Keep the full product and Stripe mappings; existing active-only rules hide it.
-- Exact ID intentionally excludes tropical-hops-harvest. Do not revive archived/draft rows.
UPDATE products
SET status = 'coming-soon', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'tropical-hops' AND status = 'active';
