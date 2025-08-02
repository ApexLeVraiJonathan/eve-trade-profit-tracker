import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LiquidityMetrics {
  itemTypeId: number;
  itemTypeName: string;

  // Cross-hub presence (arbitrage potential)
  hubCount: number; // How many of our 4 hubs trade this item
  hubIds: string[]; // Which specific hubs (BigInt as strings)

  // Trading frequency (liquidity indicator)
  totalTrades: number; // Total trades across all hubs
  avgTradesPerHub: number; // Average trades per hub

  // Value metrics (profit potential)
  avgValue: number; // Average ISK value
  totalVolume: string; // Total trading volume (BigInt as string)

  // Consistency (reliability indicator)
  tradingConsistency: number; // 0-1 score for consistent appearances
  lastSeen: Date; // Most recent trade
  daysSinceLastSeen: number; // Days since last trade

  // Liquidity score (composite)
  liquidityScore: number; // 0-100 composite score
}

export interface LiquidityCriteria {
  minHubCount?: number; // Minimum hubs (default: 2)
  minTotalTrades?: number; // Minimum total trades (default: 8)
  minValue?: number; // Minimum average ISK value (default: 100k)
  maxDaysStale?: number; // Maximum days since last trade (default: 7)
  minLiquidityScore?: number; // Minimum liquidity score (default: 50)
}

@Injectable()
export class LiquidityAnalyzerService {
  private readonly logger = new Logger(LiquidityAnalyzerService.name);

  constructor(private readonly prisma: PrismaService) {}

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
  ): Promise<number[]> {
    this.logger.log(
      `Finding liquid items at destination station ${destStationId}...`,
    );

    const defaults: Required<LiquidityCriteria> = {
      minHubCount: 1, // Single destination is fine
      minTotalTrades: 5, // Reduced from 12 to 5 - more realistic for limited historical data
      minValue: 1000000, // 1M ISK
      maxDaysStale: 7,
      minLiquidityScore: 0, // Ignore composite score
    };

    const filter = { ...defaults, ...criteria };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filter.maxDaysStale);

    // Using cutoff date: ${cutoffDate.toISOString()}

    // First, check if there are any sell orders at all for this station
    const totalSellOrders = await this.prisma.marketOrderTrade.count({
      where: {
        locationId: destStationId,
        isBuyOrder: false,
      },
    });

    const recentSellOrders = await this.prisma.marketOrderTrade.count({
      where: {
        locationId: destStationId,
        isBuyOrder: false,
        scanDate: { gte: cutoffDate },
      },
    });

    // Station has ${totalSellOrders} total sell orders, ${recentSellOrders} recent

    // Get items traded at this specific destination station (SELL ORDERS ONLY)
    const liquidItems = await this.prisma.marketOrderTrade.groupBy({
      by: ['typeId'],
      where: {
        locationId: destStationId,
        scanDate: {
          gte: cutoffDate,
        },
        isBuyOrder: false, // Only sell order completions (actual sales)
      },
      _count: { id: true },
      _avg: { iskValue: true },
      _sum: { amount: true },
      _max: { scanDate: true },
      orderBy: { _count: { id: 'desc' } }, // Most frequently traded first
    });

    // Found ${liquidItems.length} item types from groupBy

    // Apply trade count and value filters
    const filteredItems = liquidItems.filter((item, index) => {
      const tradeCount = item._count.id;
      const avgValue = Number(item._avg?.iskValue || 0);
      const passes =
        tradeCount >= filter.minTotalTrades && avgValue >= filter.minValue;

      // Filtering item ${item.typeId}: ${passes ? 'PASS' : 'FAIL'}

      return passes;
    });

    // Convert to just type IDs (temporarily revert)
    const typeIds = filteredItems.map((item) => Number(item.typeId)); // Convert BigInt to number

    this.logger.log(
      `Found ${typeIds.length} liquid items at station ${destStationId} (${filteredItems.length}/${liquidItems.length} passed filters)`,
    );

    return typeIds;
  }

  /**
   * Get items that have been traded recently (simplified for arbitrage)
   * Focus: Fast turnover items only (sold within X days)
   */
  async getRecentlyTradedItems(maxDaysStale: number = 7): Promise<number[]> {
    this.logger.log(`Finding items traded within last ${maxDaysStale} days...`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDaysStale);

    // Get items with recent trading activity (SELL ORDERS ONLY)
    const recentlyTradedItems = await this.prisma.marketOrderTrade.groupBy({
      by: ['typeId'],
      where: {
        scanDate: {
          gte: cutoffDate,
        },
        isBuyOrder: false, // Only sell order completions (actual sales)
      },
      _count: { id: true },
      _max: { scanDate: true },
      orderBy: { _count: { id: 'desc' } }, // Most frequently traded first
    });

    const typeIds = recentlyTradedItems.map((item) => item.typeId);

    this.logger.log(
      `Found ${typeIds.length} items with trading activity in last ${maxDaysStale} days`,
    );

    return typeIds;
  }

  /**
   * Get high-liquidity item type IDs for optimized ESI fetching (LEGACY - complex version)
   */
  async getHighLiquidityItems(
    criteria: LiquidityCriteria = {},
  ): Promise<number[]> {
    this.logger.log('Analyzing liquidity for high-frequency trading items...');

    const metrics = await this.analyzeLiquidityMetrics();

    // Apply filtering criteria
    const defaults: Required<LiquidityCriteria> = {
      minHubCount: 2,
      minTotalTrades: 8,
      minValue: 100000,
      maxDaysStale: 7,
      minLiquidityScore: 50,
    };

    const filter = { ...defaults, ...criteria };

    const highLiquidityItems = metrics.filter(
      (item) =>
        item.hubCount >= filter.minHubCount &&
        item.totalTrades >= filter.minTotalTrades &&
        item.avgValue >= filter.minValue &&
        item.daysSinceLastSeen <= filter.maxDaysStale &&
        item.liquidityScore >= filter.minLiquidityScore,
    );

    const typeIds = highLiquidityItems.map((item) => item.itemTypeId);

    this.logger.log(
      `Found ${typeIds.length} high-liquidity items from ${metrics.length} total analyzed items`,
    );

    return typeIds;
  }

  /**
   * Analyze liquidity metrics for all traded items
   */
  async analyzeLiquidityMetrics(): Promise<LiquidityMetrics[]> {
    this.logger.debug(
      'Computing liquidity metrics from historical trading data...',
    );

    // Get aggregated data by item type across all hubs (SELL ORDERS ONLY)
    const itemStats = await this.prisma.marketOrderTrade.groupBy({
      by: ['typeId'],
      where: {
        isBuyOrder: false, // Only sell order completions (actual sales)
      },
      _count: { id: true },
      _avg: { iskValue: true },
      _sum: { amount: true },
      _max: { scanDate: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const metrics: LiquidityMetrics[] = [];
    const now = new Date();

    // Pre-fetch all item type names to avoid N+1 database queries
    const uniqueTypeIds = itemStats.map((stat) => stat.typeId);
    const itemTypes = await this.prisma.itemType.findMany({
      where: { id: { in: uniqueTypeIds } },
      select: { id: true, name: true },
    });
    const itemTypeMap = new Map(itemTypes.map((item) => [item.id, item.name]));

    for (const stat of itemStats) {
      // Get hub distribution for this item (SELL ORDERS ONLY)
      const hubDistribution = await this.prisma.marketOrderTrade.groupBy({
        by: ['locationId'],
        where: {
          typeId: stat.typeId,
          isBuyOrder: false, // Only sell order completions
        },
        _count: { id: true },
      });

      // Get item type name from pre-fetched map
      const itemTypeName = itemTypeMap.get(stat.typeId);

      const hubCount = hubDistribution.length;
      const totalTrades = stat._count.id;
      const avgTradesPerHub = totalTrades / hubCount;
      const avgValue = Number(stat._avg.iskValue || 0);
      const totalVolume = stat._sum.amount || BigInt(0);
      const lastSeen = stat._max.scanDate || now;
      const daysSinceLastSeen = Math.floor(
        (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Calculate trading consistency (0-1 score)
      // High consistency = trades distributed across multiple hubs
      const maxTradesPerHub = Math.max(
        ...hubDistribution.map((h) => h._count.id),
      );
      const tradingConsistency =
        hubCount > 1 ? 1 - maxTradesPerHub / totalTrades : 0;

      // Calculate composite liquidity score (0-100)
      const liquidityScore = this.calculateLiquidityScore({
        hubCount,
        totalTrades,
        avgValue,
        tradingConsistency,
        daysSinceLastSeen,
      });

      metrics.push({
        itemTypeId: stat.typeId,
        itemTypeName: itemTypeName || `Type ${stat.typeId}`,
        hubCount,
        hubIds: hubDistribution.map((h) => h.locationId.toString()),
        totalTrades,
        avgTradesPerHub,
        avgValue,
        totalVolume: totalVolume.toString(),
        tradingConsistency,
        lastSeen,
        daysSinceLastSeen,
        liquidityScore,
      });
    }

    // Sort by liquidity score descending
    metrics.sort((a, b) => b.liquidityScore - a.liquidityScore);

    this.logger.debug(`Analyzed ${metrics.length} items for liquidity metrics`);
    return metrics;
  }

  /**
   * Calculate composite liquidity score (0-100)
   */
  private calculateLiquidityScore(params: {
    hubCount: number;
    totalTrades: number;
    avgValue: number;
    tradingConsistency: number;
    daysSinceLastSeen: number;
  }): number {
    const {
      hubCount,
      totalTrades,
      avgValue,
      tradingConsistency,
      daysSinceLastSeen,
    } = params;

    // Component scores (0-1 each)
    const hubScore = Math.min(hubCount / 4, 1); // Max score when trading in all 4 hubs
    const tradeScore = Math.min(totalTrades / 20, 1); // Max score at 20+ trades
    const valueScore = Math.min(avgValue / 10000000, 1); // Max score at 10M+ ISK
    const consistencyScore = tradingConsistency;
    const recencyScore = Math.max(0, 1 - daysSinceLastSeen / 7); // Decays over 7 days

    // Weighted average (higher weight on hub count and recency for arbitrage)
    const score =
      (hubScore * 0.3 + // 30% - hub diversity (arbitrage potential)
        tradeScore * 0.2 + // 20% - trade frequency
        valueScore * 0.15 + // 15% - value (profit potential)
        consistencyScore * 0.15 + // 15% - consistency
        recencyScore * 0.2) * // 20% - recency (current relevance)
      100;

    return Math.round(score);
  }

  /**
   * Get detailed liquidity report for analysis
   */
  async getLiquidityReport(limit: number = 50): Promise<{
    summary: {
      totalItemsAnalyzed: number;
      highLiquidityItems: number;
      avgLiquidityScore: number;
      topCategories: string[];
    };
    topItems: LiquidityMetrics[];
  }> {
    const metrics = await this.analyzeLiquidityMetrics();
    const highLiquidityItems = metrics.filter((m) => m.liquidityScore >= 50);
    const avgScore =
      metrics.reduce((sum, m) => sum + m.liquidityScore, 0) / metrics.length;

    return {
      summary: {
        totalItemsAnalyzed: metrics.length,
        highLiquidityItems: highLiquidityItems.length,
        avgLiquidityScore: Math.round(avgScore),
        topCategories: [], // Could be enhanced to categorize items
      },
      topItems: metrics.slice(0, limit),
    };
  }
}
