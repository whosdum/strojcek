-- CreateIndex
CREATE INDEX "appointment_status_history_appointment_id_idx" ON "appointment_status_history"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_status_history_changed_at_idx" ON "appointment_status_history"("changed_at");

-- CreateIndex
CREATE INDEX "appointments_status_start_time_idx" ON "appointments"("status", "start_time");

-- CreateIndex
CREATE INDEX "appointments_barber_id_status_start_time_idx" ON "appointments"("barber_id", "status", "start_time");
