export const up = pgm => pgm.sql(`
  ALTER TABLE client_pets
    ADD COLUMN photo_data bytea,
    ADD COLUMN photo_width integer,
    ADD COLUMN photo_height integer,
    ADD COLUMN photo_version integer NOT NULL DEFAULT 0 CHECK (photo_version >= 0),
    ADD CONSTRAINT client_pets_photo_check CHECK (
      (photo_data IS NULL AND photo_width IS NULL AND photo_height IS NULL) OR
      (photo_data IS NOT NULL AND photo_width IS NOT NULL AND photo_height IS NOT NULL
        AND photo_width BETWEEN 1 AND 768 AND photo_height BETWEEN 1 AND 768
        AND octet_length(photo_data) BETWEEN 4 AND 524288
        AND substring(photo_data from 1 for 3) = decode('ffd8ff','hex') AND photo_version > 0)
    );
`)
export const down = pgm => pgm.sql(`ALTER TABLE client_pets
  DROP CONSTRAINT client_pets_photo_check,
  DROP COLUMN photo_data, DROP COLUMN photo_width, DROP COLUMN photo_height, DROP COLUMN photo_version;`)
