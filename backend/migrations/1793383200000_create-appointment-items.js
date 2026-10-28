export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE appointments ADD CONSTRAINT appointments_items_identity_unique
      UNIQUE (id, salon_id, employee_id);

    CREATE TABLE appointment_items (
      appointment_id bigint NOT NULL,
      salon_id bigint NOT NULL,
      employee_id bigint NOT NULL,
      service_id bigint NOT NULL,
      position integer NOT NULL CHECK (position BETWEEN 1 AND 20),
      service_name varchar(150) NOT NULL,
      service_category varchar(100) NOT NULL,
      price_cents integer NOT NULL CHECK (price_cents >= 0),
      duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
      PRIMARY KEY (appointment_id, position),
      UNIQUE (appointment_id, service_id),
      CONSTRAINT appointment_items_parent_fkey
        FOREIGN KEY (appointment_id, salon_id, employee_id)
        REFERENCES appointments (id, salon_id, employee_id)
        ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
      CONSTRAINT appointment_items_qualified_fkey
        FOREIGN KEY (employee_id, service_id, salon_id)
        REFERENCES employee_services (employee_id, service_id, salon_id)
        ON DELETE RESTRICT
    );
    CREATE INDEX appointment_items_qualification_idx
      ON appointment_items (employee_id, service_id, salon_id);

    -- Historical money and duration come from the reservation, never today's catalogue.
    INSERT INTO appointment_items (
      appointment_id, salon_id, employee_id, service_id, position,
      service_name, service_category, price_cents, duration_minutes
    )
    SELECT a.id, a.salon_id, a.employee_id, a.service_id, 1,
           s.name, s.category, a.price_cents, a.duration_minutes
    FROM appointments a JOIN services s ON s.id = a.service_id AND s.salon_id = a.salon_id;

    -- Compatibility with existing single-service inserts (including fixtures).
    CREATE FUNCTION appointment_items_legacy_snapshot() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO appointment_items (
          appointment_id, salon_id, employee_id, service_id, position,
          service_name, service_category, price_cents, duration_minutes
        ) SELECT NEW.id, NEW.salon_id, NEW.employee_id, NEW.service_id, 1,
                 s.name, s.category, NEW.price_cents, NEW.duration_minutes
          FROM services s WHERE s.id = NEW.service_id AND s.salon_id = NEW.salon_id;
      ELSIF (SELECT count(*) FROM appointment_items WHERE appointment_id = NEW.id) = 1 THEN
        UPDATE appointment_items ai SET
          salon_id = NEW.salon_id, employee_id = NEW.employee_id, service_id = NEW.service_id,
          price_cents = NEW.price_cents, duration_minutes = NEW.duration_minutes,
          service_name = CASE WHEN OLD.service_id = NEW.service_id THEN ai.service_name ELSE s.name END,
          service_category = CASE WHEN OLD.service_id = NEW.service_id THEN ai.service_category ELSE s.category END
        FROM services s WHERE ai.appointment_id = NEW.id AND s.id = NEW.service_id;
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER appointment_items_legacy_insert AFTER INSERT ON appointments
      FOR EACH ROW EXECUTE FUNCTION appointment_items_legacy_snapshot();
    CREATE TRIGGER appointment_items_legacy_update
      AFTER UPDATE OF service_id, employee_id, salon_id, price_cents, duration_minutes ON appointments
      FOR EACH ROW EXECUTE FUNCTION appointment_items_legacy_snapshot();

    -- Serialize item writes on the parent so deferred aggregate checks cannot race.
    CREATE FUNCTION appointment_items_lock_parent() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'UPDATE' AND (NEW.appointment_id, NEW.salon_id, NEW.employee_id)
          IS DISTINCT FROM (OLD.appointment_id, OLD.salon_id, OLD.employee_id) THEN
        RAISE EXCEPTION 'Appointment item identity cannot change' USING ERRCODE = '23514';
      END IF;
      IF TG_OP = 'DELETE' THEN
        PERFORM id FROM appointments WHERE id = OLD.appointment_id FOR UPDATE;
        RETURN OLD;
      END IF;
      PERFORM id FROM appointments WHERE id = NEW.appointment_id FOR UPDATE;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER appointment_items_parent_lock BEFORE INSERT OR UPDATE OR DELETE ON appointment_items
      FOR EACH ROW EXECUTE FUNCTION appointment_items_lock_parent();

    CREATE FUNCTION appointment_items_validate_totals() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      target_id bigint;
      parent appointments%ROWTYPE;
      item_count bigint;
      total_price bigint;
      total_duration bigint;
      first_service bigint;
      last_position integer;
    BEGIN
      IF TG_TABLE_NAME = 'appointments' THEN
        target_id := NEW.id;
      ELSIF TG_OP = 'DELETE' THEN
        target_id := OLD.appointment_id;
      ELSE
        target_id := NEW.appointment_id;
      END IF;
      SELECT * INTO parent FROM appointments WHERE id = target_id;
      IF NOT FOUND THEN RETURN NULL; END IF;
      SELECT count(*), sum(price_cents), sum(duration_minutes), max(position)
        INTO item_count, total_price, total_duration, last_position
        FROM appointment_items WHERE appointment_id = target_id;
      SELECT service_id INTO first_service FROM appointment_items
        WHERE appointment_id = target_id AND position = 1;
      IF item_count < 1 OR item_count > 20 OR item_count <> last_position
          OR total_price IS DISTINCT FROM parent.price_cents::bigint
          OR total_duration IS DISTINCT FROM parent.duration_minutes::bigint
          OR first_service IS DISTINCT FROM parent.service_id THEN
        RAISE EXCEPTION 'Appointment items do not match reservation totals'
          USING ERRCODE = '23514', CONSTRAINT = 'appointment_items_totals_match';
      END IF;
      RETURN NULL;
    END;
    $$;
    CREATE CONSTRAINT TRIGGER appointment_items_totals_check
      AFTER INSERT OR UPDATE OR DELETE ON appointment_items
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
      EXECUTE FUNCTION appointment_items_validate_totals();
    CREATE CONSTRAINT TRIGGER appointments_items_totals_check
      AFTER INSERT OR UPDATE ON appointments
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
      EXECUTE FUNCTION appointment_items_validate_totals();
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM appointment_items GROUP BY appointment_id HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Cannot remove appointment items while multi-service reservations exist';
      END IF;
    END $$;
    DROP TRIGGER appointments_items_totals_check ON appointments;
    DROP TRIGGER appointment_items_legacy_insert ON appointments;
    DROP TRIGGER appointment_items_legacy_update ON appointments;
    DROP TABLE appointment_items;
    DROP FUNCTION appointment_items_validate_totals();
    DROP FUNCTION appointment_items_lock_parent();
    DROP FUNCTION appointment_items_legacy_snapshot();
    ALTER TABLE appointments DROP CONSTRAINT appointments_items_identity_unique;
  `)
}
