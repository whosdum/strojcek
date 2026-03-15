CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING GIST (
    barber_id gist_text_ops WITH =,
    tsrange(start_time, end_time) WITH &&
  )
  WHERE (status NOT IN ('CANCELLED'::"AppointmentStatus", 'NO_SHOW'::"AppointmentStatus"));
