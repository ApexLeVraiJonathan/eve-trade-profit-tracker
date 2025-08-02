-- CreateEnum
CREATE TYPE "public"."CycleStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."CycleItemStatus" AS ENUM ('PLANNED', 'BUYING', 'BOUGHT', 'TRANSPORTING', 'SELLING', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "public"."trading_cycles" (
    "cycle_id" TEXT NOT NULL,
    "name" TEXT,
    "source_hub" TEXT NOT NULL,
    "total_capital" BIGINT NOT NULL,
    "capital_used" BIGINT NOT NULL DEFAULT 0,
    "status" "public"."CycleStatus" NOT NULL DEFAULT 'PLANNED',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cargo_capacity" INTEGER NOT NULL DEFAULT 60000,
    "min_profit_margin" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "min_liquidity" INTEGER NOT NULL DEFAULT 4,
    "transport_costs" JSONB NOT NULL,
    "hub_allocations" JSONB NOT NULL,
    "total_profit" BIGINT NOT NULL DEFAULT 0,
    "total_transport_cost" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_cycles_pkey" PRIMARY KEY ("cycle_id")
);

-- CreateTable
CREATE TABLE "public"."cycle_items" (
    "cycle_item_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "item_type_id" INTEGER NOT NULL,
    "item_name" TEXT NOT NULL,
    "source_hub" TEXT NOT NULL,
    "destination_hub" TEXT NOT NULL,
    "buy_price" BIGINT NOT NULL,
    "sell_price" BIGINT NOT NULL,
    "planned_quantity" INTEGER NOT NULL,
    "actual_quantity" INTEGER NOT NULL DEFAULT 0,
    "total_cargo" DOUBLE PRECISION NOT NULL,
    "total_cost" BIGINT NOT NULL,
    "expected_profit" BIGINT NOT NULL,
    "transport_cost" BIGINT NOT NULL,
    "net_profit" BIGINT NOT NULL,
    "margin" DOUBLE PRECISION NOT NULL,
    "profit_per_m3" BIGINT NOT NULL,
    "days_traded" INTEGER NOT NULL,
    "total_amount_traded_per_week" INTEGER NOT NULL,
    "recorded_price_low" BIGINT NOT NULL,
    "recorded_price_high" BIGINT NOT NULL,
    "recorded_price_avg" BIGINT NOT NULL,
    "raw_market_price" BIGINT NOT NULL,
    "validated_price" BIGINT NOT NULL,
    "price_was_adjusted" BOOLEAN NOT NULL DEFAULT false,
    "price_adjustment" BIGINT NOT NULL DEFAULT 0,
    "status" "public"."CycleItemStatus" NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_items_pkey" PRIMARY KEY ("cycle_item_id")
);

-- CreateTable
CREATE TABLE "public"."cycle_transactions" (
    "transaction_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "cycle_item_id" TEXT,
    "transaction_type" "public"."TransactionType" NOT NULL,
    "item_type_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_per_unit" BIGINT NOT NULL,
    "total_value" BIGINT NOT NULL,
    "location_id" BIGINT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL,
    "estimated_price" BIGINT,
    "variance" BIGINT DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- AddForeignKey
ALTER TABLE "public"."cycle_items" ADD CONSTRAINT "cycle_items_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."trading_cycles"("cycle_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_items" ADD CONSTRAINT "cycle_items_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_transactions" ADD CONSTRAINT "cycle_transactions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."trading_cycles"("cycle_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_transactions" ADD CONSTRAINT "cycle_transactions_cycle_item_id_fkey" FOREIGN KEY ("cycle_item_id") REFERENCES "public"."cycle_items"("cycle_item_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_transactions" ADD CONSTRAINT "cycle_transactions_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cycle_transactions" ADD CONSTRAINT "cycle_transactions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;
