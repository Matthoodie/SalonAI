export const up = pgm => pgm.sql(`
  CREATE TABLE client_pets (
    id bigserial PRIMARY KEY,
    salon_id bigint NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    client_id bigint NOT NULL,
    name varchar(100) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    species varchar(16) NOT NULL CHECK (species IN ('dog','cat','other')),
    breed varchar(150) NOT NULL DEFAULT '',
    notes varchar(2000) NOT NULL DEFAULT '',
    active boolean NOT NULL DEFAULT true,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT client_pets_client_tenant_fk FOREIGN KEY (client_id,salon_id)
      REFERENCES clients(id,salon_id) ON DELETE CASCADE,
    CONSTRAINT client_pets_identity_unique UNIQUE (id,client_id,salon_id)
  );
  CREATE INDEX client_pets_owner_idx ON client_pets(salon_id,client_id,active,id);
`)
export const down = pgm => pgm.sql('DROP TABLE client_pets;')
