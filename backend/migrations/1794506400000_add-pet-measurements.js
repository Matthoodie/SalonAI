export const up = pgm => pgm.sql(`
  ALTER TABLE client_pets
    ADD COLUMN size_category varchar(12),
    ADD COLUMN weight_grams integer,
    ADD CONSTRAINT client_pets_size_check CHECK (size_category IS NULL OR size_category IN ('small','medium','large','giant')),
    ADD CONSTRAINT client_pets_weight_check CHECK (weight_grams IS NULL OR weight_grams BETWEEN 1 AND 200000);
`)
export const down = pgm => pgm.sql(`ALTER TABLE client_pets
  DROP CONSTRAINT client_pets_size_check, DROP CONSTRAINT client_pets_weight_check,
  DROP COLUMN size_category, DROP COLUMN weight_grams;`)
