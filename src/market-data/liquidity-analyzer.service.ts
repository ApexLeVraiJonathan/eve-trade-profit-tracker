import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackedStationService } from './tracked-station.service';
import {
  LiquidityCriteria,
  LiquidItemData,
} from './interfaces/liquidity.interface';

@Injectable()
export class LiquidityAnalyzerService {
  private readonly logger = new Logger(LiquidityAnalyzerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackedStationService: TrackedStationService,
  ) {}

  /**
   * Get items that are liquid at a specific destination station
   * Focus: Items actively traded at the destination for arbitrage selling
   */
  /**
   * Debug method to check raw station data
   */
  async debugRawStationData(stationId: bigint) {
    // Get basic counts
    const totalTrades = await this.prisma.marketOrderTrade.count({
      where: { locationId: stationId },
    });

    const sellOrderTrades = await this.prisma.marketOrderTrade.count({
      where: { locationId: stationId, isBuyOrder: false },
    });

    const buyOrderTrades = await this.prisma.marketOrderTrade.count({
      where: { locationId: stationId, isBuyOrder: true },
    });

    // Get sample data
    const sampleTrades = await this.prisma.marketOrderTrade.findMany({
      where: { locationId: stationId },
      take: 5,
      select: {
        typeId: true,
        isBuyOrder: true,
        amount: true,
        iskValue: true,
        scanDate: true,
      },
      orderBy: { scanDate: 'desc' },
    });

    return {
      stationId: stationId.toString(),
      totalTrades: Number(totalTrades),
      sellOrderTrades: Number(sellOrderTrades),
      buyOrderTrades: Number(buyOrderTrades),
      sampleTrades: sampleTrades.map((trade) => ({
        typeId: trade.typeId.toString(),
        isBuyOrder: trade.isBuyOrder,
        amount: trade.amount.toString(),
        iskValue: trade.iskValue.toString(),
        scanDate: trade.scanDate,
      })),
    };
  }

  async getDestinationLiquidity(
    destStationId: bigint,
    criteria: LiquidityCriteria = {},
  ): Promise<LiquidItemData[]> {
    this.logger.log(
      `Finding liquid items at destination station ${destStationId} (days-per-week logic)...`,
    );

    const defaults: Required<LiquidityCriteria> = {
      minDaysPerWeek: 4, // 4+ days per week traded
      minValue: 1000000, // 1M ISK
    };

    const filter = { ...defaults, ...criteria };
    const minDaysPerWeek = filter.minDaysPerWeek;

    // Find the latest date in the database for this station
    const latestTradeResult = await this.prisma.marketOrderTrade.findFirst({
      where: {
        locationId: destStationId,
        isBuyOrder: false,
      },
      select: { scanDate: true },
      orderBy: { scanDate: 'desc' },
    });

    if (!latestTradeResult) {
      this.logger.warn(`No trades found for station ${destStationId}`);
      return [];
    }

    const latestDate = latestTradeResult.scanDate;
    const cutoffDate = new Date(latestDate);
    cutoffDate.setDate(cutoffDate.getDate() - 6); // 7-day window (latest + 6 days back)

    this.logger.log(
      `🗓️ Analyzing 7-day window: ${cutoffDate.toISOString().split('T')[0]} to ${latestDate.toISOString().split('T')[0]}`,
    );

    // Get all trades in the 7-day window, grouped by item and date
    const tradesInWindow = await this.prisma.marketOrderTrade.findMany({
      where: {
        locationId: destStationId,
        scanDate: {
          gte: cutoffDate,
          lte: latestDate,
        },
        isBuyOrder: false, // Only sell order completions (actual sales)
      },
      select: {
        typeId: true,
        scanDate: true,
        iskValue: true,
        amount: true, // Track units traded
        high: true,
        low: true,
        avg: true,
      },
    });

    // Group by typeId and count distinct trading days
    const itemTradingDays = new Map<string, Set<string>>();
    const itemValues = new Map<string, number[]>();
    const itemAmounts = new Map<string, number[]>(); // Track units traded
    const itemPrices = new Map<
      string,
      { highs: number[]; lows: number[]; avgs: number[] }
    >();

    for (const trade of tradesInWindow) {
      const typeIdStr = trade.typeId.toString();
      const dateStr = trade.scanDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Track trading days
      if (!itemTradingDays.has(typeIdStr)) {
        itemTradingDays.set(typeIdStr, new Set());
      }
      itemTradingDays.get(typeIdStr)!.add(dateStr);

      // Track values for average calculation
      if (!itemValues.has(typeIdStr)) {
        itemValues.set(typeIdStr, []);
      }
      itemValues.get(typeIdStr)!.push(Number(trade.iskValue));

      // Track amounts (units) for weekly volume calculation
      if (!itemAmounts.has(typeIdStr)) {
        itemAmounts.set(typeIdStr, []);
      }
      itemAmounts.get(typeIdStr)!.push(Number(trade.amount));

      // Track price data (high, low, avg from each trade record)
      if (!itemPrices.has(typeIdStr)) {
        itemPrices.set(typeIdStr, { highs: [], lows: [], avgs: [] });
      }
      const priceData = itemPrices.get(typeIdStr)!;
      priceData.highs.push(Number(trade.high));
      priceData.lows.push(Number(trade.low));
      priceData.avgs.push(Number(trade.avg));
    }

    // Filter items based on days per week and value criteria
    const liquidItems: LiquidItemData[] = [];

    for (const [typeIdStr, tradingDays] of itemTradingDays) {
      const daysCount = tradingDays.size;
      const values = itemValues.get(typeIdStr) || [];
      const amounts = itemAmounts.get(typeIdStr) || [];
      const avgValue =
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
      const totalUnitsTraded = amounts.reduce((a, b) => a + b, 0);

      const passedDays = daysCount >= minDaysPerWeek;
      const passedValue = avgValue >= filter.minValue;
      const passes = passedDays && passedValue;

      if (passes) {
        // Calculate price statistics from the collected price data
        const priceData = itemPrices.get(typeIdStr);
        const priceStats = priceData
          ? {
              high: Math.max(...priceData.highs),
              low: Math.min(...priceData.lows),
              average:
                priceData.avgs.reduce((a, b) => a + b, 0) /
                priceData.avgs.length,
            }
          : {
              high: 0,
              low: 0,
              average: 0,
            };

        liquidItems.push({
          typeId: Number(typeIdStr),
          daysTraded: daysCount,
          totalValue: values.reduce((a, b) => a + b, 0),
          totalAmountTradedPerWeek: totalUnitsTraded, // Total units traded in the 7-day window
          avgValue: avgValue,
          priceData: priceStats,
        });
      }
    }

    this.logger.log(
      `Found ${liquidItems.length} liquid items at station ${destStationId} (traded on ${minDaysPerWeek}+ days in past week)`,
    );

    return liquidItems;
  }

  /**
   * Get liquid items at multiple specific destinations (concurrent analysis)
   * Returns a map of stationId -> liquid item data for each destination
   */
  async getMultiDestinationLiquidity(
    stationIds: bigint[],
    criteria: LiquidityCriteria = {},
  ): Promise<Map<string, LiquidItemData[]>> {
    this.logger.log(
      `Analyzing liquidity at ${stationIds.length} specific stations concurrently...`,
    );

    // Run liquidity analysis concurrently for specified stations only
    const stationResults = await Promise.allSettled(
      stationIds.map(async (stationId) => {
        try {
          const liquidItems = await this.getDestinationLiquidity(
            stationId,
            criteria,
          );
          return { stationId: stationId.toString(), liquidItems };
        } catch (error) {
          this.logger.warn(
            `Failed to analyze station ${stationId}: ${(error as Error).message}`,
          );
          return { stationId: stationId.toString(), liquidItems: [] };
        }
      }),
    );

    // Build result map: station ID -> liquid items
    const resultMap = new Map<string, LiquidItemData[]>();

    stationResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { stationId, liquidItems } = result.value;
        // Return full liquid item data for price analysis
        resultMap.set(stationId, liquidItems);
      }
    });

    const totalItems = Array.from(resultMap.values()).reduce(
      (sum, items) => sum + items.length,
      0,
    );

    this.logger.log(
      `Found ${totalItems} total liquid items across ${resultMap.size} stations`,
    );

    return resultMap;
  }
}
