-- AlterTable
ALTER TABLE "public"."item_types" ADD COLUMN     "volume" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "public"."market_prices" (
    "id" SERIAL NOT NULL,
    "item_type_id" INTEGER NOT NULL,
    "region_id" INTEGER NOT NULL,
    "location_id" BIGINT NOT NULL,
    "order_type" TEXT NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "volume" INTEGER NOT NULL,
    "min_volume" INTEGER,
    "duration" INTEGER NOT NULL,
    "issued" TIMESTAMP(3) NOT NULL,
    "order_range" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_prices_item_type_id_region_id_order_type_idx" ON "public"."market_prices"("item_type_id", "region_id", "order_type");

-- CreateIndex
CREATE INDEX "market_prices_location_id_item_type_id_idx" ON "public"."market_prices"("location_id", "item_type_id");

-- CreateIndex
CREATE INDEX "market_prices_price_order_type_idx" ON "public"."market_prices"("price", "order_type");

-- CreateIndex
CREATE INDEX "market_prices_issued_idx" ON "public"."market_prices"("issued");

-- CreateIndex
CREATE UNIQUE INDEX "market_prices_item_type_id_location_id_order_type_price_vol_key" ON "public"."market_prices"("item_type_id", "location_id", "order_type", "price", "volume", "issued");

-- AddForeignKey
ALTER TABLE "public"."market_prices" ADD CONSTRAINT "market_prices_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_prices" ADD CONSTRAINT "market_prices_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_prices" ADD CONSTRAINT "market_prices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;
