-- CreateTable
CREATE TABLE "public"."item_types" (
    "type_id" INTEGER NOT NULL,
    "type_name" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_types_pkey" PRIMARY KEY ("type_id")
);

-- CreateTable
CREATE TABLE "public"."regions" (
    "region_id" INTEGER NOT NULL,
    "region_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("region_id")
);

-- CreateTable
CREATE TABLE "public"."solar_systems" (
    "solar_system_id" INTEGER NOT NULL,
    "solar_system_name" TEXT NOT NULL,
    "region_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solar_systems_pkey" PRIMARY KEY ("solar_system_id")
);

-- CreateTable
CREATE TABLE "public"."stations" (
    "station_id" BIGINT NOT NULL,
    "solar_system_id" INTEGER NOT NULL,
    "station_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("station_id")
);

-- CreateTable
CREATE TABLE "public"."market_order_trades" (
    "id" SERIAL NOT NULL,
    "location_id" BIGINT NOT NULL,
    "region_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "is_buy_order" BOOLEAN NOT NULL,
    "has_gone" BOOLEAN NOT NULL,
    "scan_date" TIMESTAMP(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "high" DECIMAL(15,2) NOT NULL,
    "low" DECIMAL(15,2) NOT NULL,
    "avg" DECIMAL(15,2) NOT NULL,
    "order_num" INTEGER NOT NULL,
    "isk_value" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_order_trades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_order_trades_scan_date_region_id_type_id_idx" ON "public"."market_order_trades"("scan_date", "region_id", "type_id");

-- CreateIndex
CREATE INDEX "market_order_trades_location_id_type_id_scan_date_idx" ON "public"."market_order_trades"("location_id", "type_id", "scan_date");

-- CreateIndex
CREATE INDEX "market_order_trades_region_id_scan_date_idx" ON "public"."market_order_trades"("region_id", "scan_date");

-- CreateIndex
CREATE INDEX "market_order_trades_type_id_scan_date_idx" ON "public"."market_order_trades"("type_id", "scan_date");

-- CreateIndex
CREATE UNIQUE INDEX "market_order_trades_location_id_type_id_scan_date_is_buy_or_key" ON "public"."market_order_trades"("location_id", "type_id", "scan_date", "is_buy_order");

-- AddForeignKey
ALTER TABLE "public"."solar_systems" ADD CONSTRAINT "solar_systems_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stations" ADD CONSTRAINT "stations_solar_system_id_fkey" FOREIGN KEY ("solar_system_id") REFERENCES "public"."solar_systems"("solar_system_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_order_trades" ADD CONSTRAINT "market_order_trades_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_order_trades" ADD CONSTRAINT "market_order_trades_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_order_trades" ADD CONSTRAINT "market_order_trades_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;
