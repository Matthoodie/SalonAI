// Optional setup state: existing salons are not enrolled or modified by migration.
export const up = pgm => pgm.sql(`
  CREATE TABLE salon_setup (
    salon_id bigint PRIMARY KEY REFERENCES salons(id) ON DELETE CASCADE,
    business_type varchar(20) CHECK (business_type IN ('hair','grooming','mixed','other')),
    location varchar(250) NOT NULL DEFAULT '',
    team_mode varchar(10) CHECK (team_mode IN ('solo','team')),
    owner_provides_services boolean,
    last_step varchar(20) NOT NULL DEFAULT 'business'
      CHECK (last_step IN ('business','salon','team','services','schedule','review')),
    revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
    updated_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
  );
  CREATE INDEX salon_setup_updated_by_idx ON salon_setup(updated_by_user_id);
`)
export const down = pgm => pgm.sql('DROP TABLE salon_setup;')
