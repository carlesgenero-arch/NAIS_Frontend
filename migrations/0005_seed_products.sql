-- Initial snapshot of ProductService; prices are per box in EUR cents.
-- Re-running preserves existing product rows, including later edits.
-- Stripe IDs remain NULL: runtime bindings are not Stripe identifiers.
-- Existing checkout mapping remains unchanged:
-- orange-spritz -> STRIPE_PRICE_ORANGE_SPRITZ
-- passion-hugo -> STRIPE_PRICE_PASSION_HUGO
-- ginger-crush -> STRIPE_PRICE_GINGER_CRUSH
-- tropical-hops -> STRIPE_PRICE_TROPICAL_HOPS
-- pack-variat -> STRIPE_PRICE_PACK_VARIAT
-- Harvest has no checkout binding and remains coming-soon.
-- feature_image_url maps to Product.featureImageUrl (currently unset).

INSERT INTO products (
  id, slug, name, description, status, price_cents, currency,
  stripe_product_id, stripe_price_id, image_url, feature_image_url
) VALUES
  ('orange-spritz', 'orange-spritz', 'ORANGE SPRITZ', 'Cítrica amb un toc amarg i àcid. Caràcter i puresa a cada glop', 'active', 3600, 'eur', NULL, NULL, 'images/products/mocktails_3.png', NULL),
  ('passion-hugo', 'passion-hugo', 'PASSION HUGO', 'Àcida, silvestre i apassionada. Explosió floral', 'active', 3600, 'eur', NULL, NULL, 'images/products/mocktails_1.png', NULL),
  ('ginger-crush', 'ginger-crush', 'GINGER CRUSH', 'Afruitada, tropical i lleugerament especiada. Vibrant i recomfortant', 'active', 3600, 'eur', NULL, NULL, 'images/products/mocktails_2.png', NULL),
  ('tropical-hops', 'tropical-hops', 'TROPICAL HOPS', 'Tot el caràcter de la fruita i la personalitat del llúpol. Bomba de sabor', 'active', 3600, 'eur', NULL, NULL, 'images/products/hops_1.png', NULL),
  ('pack-variat', 'pack-variat', 'PACK VARIAT', 'Un pack amb Orange Spritz, Passion Hugo, Ginger Crush i Tropical Hops.', 'active', 3600, 'eur', NULL, NULL, 'images/products/pack_sf.png', NULL),
  ('tropical-hops-harvest', 'tropical-hops-harvest', 'TROPICAL HOPS HARVEST', 'Tot el caràcter de la fruita i la personalitat del llúpol. Bomba de sabor', 'coming-soon', 3600, 'eur', NULL, NULL, 'images/products/hops_2.png', NULL)
ON CONFLICT(id) DO NOTHING;
