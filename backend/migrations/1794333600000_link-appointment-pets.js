// Additive migration: existing bookings remain unclassified (NULL), never guessed.
export const up = pgm => pgm.sql(`
  ALTER TABLE appointments
    ADD COLUMN recipient_type varchar(8),
    ADD COLUMN pet_id bigint,
    ADD COLUMN pet_name varchar(100),
    ADD COLUMN pet_species varchar(16),
    ADD COLUMN pet_breed varchar(150),
    ADD COLUMN recipient_revision integer NOT NULL DEFAULT 1,
    ADD CONSTRAINT appointments_recipient_revision_check CHECK (recipient_revision > 0),
    ADD CONSTRAINT appointments_recipient_check CHECK (
      (recipient_type IS NULL AND pet_id IS NULL AND pet_name IS NULL AND pet_species IS NULL AND pet_breed IS NULL)
      OR (recipient_type IS NOT NULL AND recipient_type = 'person' AND pet_id IS NULL AND pet_name IS NULL AND pet_species IS NULL AND pet_breed IS NULL)
      OR (recipient_type IS NOT NULL AND recipient_type = 'pet' AND pet_id IS NOT NULL AND pet_name IS NOT NULL
        AND char_length(btrim(pet_name)) BETWEEN 1 AND 100
        AND pet_species IS NOT NULL AND pet_species IN ('dog','cat','other') AND pet_breed IS NOT NULL)
    ),
    ADD CONSTRAINT appointments_pet_owner_salon_fk FOREIGN KEY (pet_id,client_id,salon_id)
      REFERENCES client_pets(id,client_id,salon_id) ON DELETE NO ACTION;
  ALTER TABLE appointments ADD CONSTRAINT appointments_pet_no_overlap
    EXCLUDE USING gist (salon_id WITH =, pet_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&)
    WHERE (pet_id IS NOT NULL AND status <> 'cancelled');
  CREATE INDEX appointments_pet_history_idx ON appointments(salon_id,pet_id,starts_at DESC,id DESC)
    WHERE pet_id IS NOT NULL;
`)
export const down = pgm => pgm.sql(`
  ALTER TABLE appointments DROP CONSTRAINT appointments_pet_no_overlap,
    DROP CONSTRAINT appointments_pet_owner_salon_fk,
    DROP CONSTRAINT appointments_recipient_check,
    DROP CONSTRAINT appointments_recipient_revision_check;
  DROP INDEX appointments_pet_history_idx;
  ALTER TABLE appointments DROP COLUMN recipient_type, DROP COLUMN pet_id,
    DROP COLUMN pet_name, DROP COLUMN pet_species, DROP COLUMN pet_breed, DROP COLUMN recipient_revision;
`)
