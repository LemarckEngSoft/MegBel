ALTER TABLE pet_items DROP CONSTRAINT IF EXISTS pet_items_category_check;
ALTER TABLE pet_items ADD CONSTRAINT pet_items_category_check CHECK (category IN ('base', 'eyes', 'mouth', 'expression', 'hair', 'top', 'bottom', 'shoes', 'hat', 'glasses', 'accessory'));
INSERT INTO pet_items (category, name, description, layer, sort_order)
SELECT 'hair', 'Cabelo ' || number, 'Placeholder de personalizacao', 4, number
FROM generate_series(1, 30) AS number
ON CONFLICT DO NOTHING;
