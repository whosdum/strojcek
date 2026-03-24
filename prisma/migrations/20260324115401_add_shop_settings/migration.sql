-- CreateTable
CREATE TABLE "shop_settings" (
    "id" TEXT NOT NULL,
    "slot_interval_minutes" INTEGER NOT NULL DEFAULT 60,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);
