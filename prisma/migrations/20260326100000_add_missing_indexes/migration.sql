-- CreateIndex
CREATE INDEX "appointments_customer_id_idx" ON "appointments"("customer_id");

-- CreateIndex
CREATE INDEX "schedules_barber_id_day_of_week_idx" ON "schedules"("barber_id", "day_of_week");
