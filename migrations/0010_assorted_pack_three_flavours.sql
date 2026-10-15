-- Presentation-only update. Preserve status, pricing, Stripe mappings and order snapshots.
UPDATE products
SET description = 'Un pack amb Orange Spritz, Passion Hugo i Ginger Crush.',
    image_url = 'images/products/pack_3.png',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'pack-variat'
  AND (description IS NOT 'Un pack amb Orange Spritz, Passion Hugo i Ginger Crush.'
    OR image_url IS NOT 'images/products/pack_3.png');
