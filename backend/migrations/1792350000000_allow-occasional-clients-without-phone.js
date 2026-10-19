export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE clients
      ADD COLUMN is_occasional boolean NOT NULL DEFAULT false;

    ALTER TABLE clients
      ALTER COLUMN phone_country_code DROP NOT NULL,
      ALTER COLUMN phone_number DROP NOT NULL,
      ALTER COLUMN phone_normalized DROP NOT NULL;

    ALTER TABLE clients
      ADD CONSTRAINT clients_phone_policy_check
      CHECK (
        (
          phone_country_code IS NOT NULL
          AND phone_number IS NOT NULL
          AND phone_normalized IS NOT NULL
          AND length(trim(phone_country_code)) > 0
          AND length(trim(phone_number)) > 0
          AND length(trim(phone_normalized)) > 0
        )
        OR
        (
          is_occasional = true
          AND phone_country_code IS NULL
          AND phone_number IS NULL
          AND phone_normalized IS NULL
        )
      );
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM clients
        WHERE phone_country_code IS NULL
           OR phone_number IS NULL
           OR phone_normalized IS NULL
      ) THEN
        RAISE EXCEPTION
          'Cannot revert migration while clients without phone data exist.';
      END IF;
    END
    $$;

    ALTER TABLE clients
      ALTER COLUMN phone_country_code SET NOT NULL,
      ALTER COLUMN phone_number SET NOT NULL,
      ALTER COLUMN phone_normalized SET NOT NULL;

    ALTER TABLE clients
      DROP CONSTRAINT clients_phone_policy_check;

    ALTER TABLE clients
      DROP COLUMN is_occasional;
  `)
}