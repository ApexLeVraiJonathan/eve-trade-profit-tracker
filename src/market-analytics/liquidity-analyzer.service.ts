import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LiquidityCriteria,
  LiquidItemData,
} from './interfaces/liquidity.interface';

@Injectable()
export class LiquidityAnalyzerService {
  private readonly logger = new Logger(LiquidityAnalyzerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Debug method to check raw station data
   */
  async debugRawStationData(stationId: bigint) {
    this.logger.debug(`Getting raw station data for ${stationId}`);

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

  /**
   * Get items that are liquid at a specific destination station
   * Focus: Items actively traded at the destination for arbitrage selling
   */
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

    this.logger.debug(
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
    const itemAmounts = new Map<string, number[]>();
    const itemPrices = new Map<
      string,
      { high: number[]; low: number[]; avg: number[] }
    >();

    for (const trade of tradesInWindow) {
      const typeKey = trade.typeId.toString();
      const dateKey = trade.scanDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Track distinct trading days
      if (!itemTradingDays.has(typeKey)) {
        itemTradingDays.set(typeKey, new Set());
      }
      itemTradingDays.get(typeKey)!.add(dateKey);

      // Track ISK values
      if (!itemValues.has(typeKey)) {
        itemValues.set(typeKey, []);
      }
      itemValues.get(typeKey)!.push(Number(trade.iskValue));

      // Track amounts traded
      if (!itemAmounts.has(typeKey)) {
        itemAmounts.set(typeKey, []);
      }
      itemAmounts.get(typeKey)!.push(Number(trade.amount));

      // Track price data
      if (!itemPrices.has(typeKey)) {
        itemPrices.set(typeKey, { high: [], low: [], avg: [] });
      }
      const priceData = itemPrices.get(typeKey)!;
      priceData.high.push(Number(trade.high));
      priceData.low.push(Number(trade.low));
      priceData.avg.push(Number(trade.avg));
    }

    // Filter and create results
    const liquidItems: LiquidItemData[] = [];

    for (const [typeKey, tradingDays] of itemTradingDays) {
      const daysTraded = tradingDays.size;

      if (daysTraded >= minDaysPerWeek) {
        const values = itemValues.get(typeKey) || [];
        const amounts = itemAmounts.get(typeKey) || [];
        const prices = itemPrices.get(typeKey) || {
          high: [],
          low: [],
          avg: [],
        };

        const totalValue = values.reduce((sum, val) => sum + val, 0);
        const avgValue = totalValue / values.length;

        if (totalValue >= filter.minValue) {
          const totalAmountTradedPerWeek = amounts.reduce(
            (sum, amount) => sum + amount,
            0,
          );

          liquidItems.push({
            typeId: parseInt(typeKey),
            daysTraded,
            totalValue,
            totalAmountTradedPerWeek,
            avgValue,
            priceData: {
              high: Math.max(...prices.high, 0),
              low: Math.min(...prices.low, 0),
              average:
                prices.avg.reduce((sum, price) => sum + price, 0) /
                prices.avg.length,
            },
          });
        }
      }
    }

    // Sort by total value (biggest markets first)
    liquidItems.sort((a, b) => b.totalValue - a.totalValue);

    this.logger.log(
      `Found ${liquidItems.length} liquid items meeting criteria (${minDaysPerWeek}+ days, ${filter.minValue}+ ISK)`,
    );

    return liquidItems;
  }

  /**
   * Analyze liquidity across multiple stations for comparison
   */
  async analyzeMultiStationLiquidity(
    stationIds: bigint[],
    criteria: LiquidityCriteria = {},
  ): Promise<Record<string, LiquidItemData[]>> {
    this.logger.log(`Analyzing liquidity across ${stationIds.length} stations`);

    const results: Record<string, LiquidItemData[]> = {};

    // Process stations concurrently for better performance
    const liquidityPromises = stationIds.map(async (stationId) => {
      const liquidity = await this.getDestinationLiquidity(stationId, criteria);
      return { stationId: stationId.toString(), liquidity };
    });

    const liquidityResults = await Promise.all(liquidityPromises);

    for (const { stationId, liquidity } of liquidityResults) {
      results[stationId] = liquidity;
    }

    this.logger.log(`Completed multi-station liquidity analysis`);
    return results;
  }
}
