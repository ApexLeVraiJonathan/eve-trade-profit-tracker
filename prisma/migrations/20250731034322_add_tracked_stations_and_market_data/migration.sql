-- DropIndex
DROP INDEX "public"."market_order_trades_scan_date_region_id_type_id_idx";

-- CreateTable
CREATE TABLE "public"."tracked_stations" (
    "id" SERIAL NOT NULL,
    "station_id" BIGINT NOT NULL,
    "station_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "added_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_stations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracked_stations_station_id_key" ON "public"."tracked_stations"("station_id");

-- CreateIndex
CREATE INDEX "market_order_trades_scan_date_location_id_type_id_idx" ON "public"."market_order_trades"("scan_date", "location_id", "type_id");

-- CreateIndex
CREATE INDEX "market_order_trades_is_buy_order_scan_date_idx" ON "public"."market_order_trades"("is_buy_order", "scan_date");

-- AddForeignKey
ALTER TABLE "public"."tracked_stations" ADD CONSTRAINT "tracked_stations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;
