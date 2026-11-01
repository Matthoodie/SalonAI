export const shorthands=undefined
export const up=pgm=>{
  pgm.sql(`CREATE TABLE pricelist_recognition_usage (
    salon_id bigint NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    usage_date date NOT NULL,
    attempts integer NOT NULL CHECK (attempts > 0),
    PRIMARY KEY (salon_id, usage_date)
  ); CREATE INDEX pricelist_recognition_usage_date_idx ON pricelist_recognition_usage (usage_date);`)
}
export const down=pgm=>pgm.dropTable('pricelist_recognition_usage')
