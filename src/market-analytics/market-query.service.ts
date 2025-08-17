import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataFilters } from '../common/interfaces/market-data.interface';
import { MarketOrderTradeDto } from '../common/dto/market-data.dto';

@Injectable()
export class MarketQueryService {
  private readonly logger = new Logger(MarketQueryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Query market data with filters
   */
  async queryMarketData(
    filters: MarketDataFilters,
  ): Promise<MarketOrderTradeDto[]> {
    this.logger.debug(
      `Querying market data with filters: ${JSON.stringify(filters)}`,
    );

    // Build where clause based on filters

    const where = {
      ...(filters.stationIds &&
        filters.stationIds.length > 0 && {
          locationId: { in: filters.stationIds },
        }),
      ...(filters.typeIds &&
        filters.typeIds.length > 0 && {
          typeId: { in: filters.typeIds },
        }),
      ...((filters.startDate || filters.endDate) && {
        scanDate: {
          ...(filters.startDate && { gte: filters.startDate }),
          ...(filters.endDate && { lte: filters.endDate }),
        },
      }),
      ...(filters.isBuyOrder !== undefined && {
        isBuyOrder: filters.isBuyOrder,
      }),
    };

    const trades = await this.prisma.marketOrderTrade.findMany({
      where,
      include: {
        region: true,
        itemType: true,
        station: true,
      },
      orderBy: { scanDate: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });

    return trades.map((trade) => ({
      id: trade.id,
      locationId: trade.locationId.toString(),
      regionId: trade.regionId,
      typeId: trade.typeId,
      isBuyOrder: trade.isBuyOrder,
      hasGone: trade.hasGone,
      scanDate: trade.scanDate,
      amount: trade.amount.toString(),
      high: Number(trade.high),
      low: Number(trade.low),
      avg: Number(trade.avg),
      orderNum: trade.orderNum,
      iskValue: trade.iskValue.toString(),
      regionName: trade.region.name,
      itemTypeName: trade.itemType.name,
      stationName: trade.station?.name || 'Unknown Station',
    }));
  }

  /**
   * Get market data statistics
   */
  async getMarketDataStats() {
    this.logger.debug('Getting market data statistics');

    const [
      totalRecords,
      uniqueStations,
      uniqueItems,
      dateRange,
      recentActivity,
    ] = await Promise.all([
      // Total records
      this.prisma.marketOrderTrade.count(),

      // Unique stations
      this.prisma.marketOrderTrade
        .groupBy({
          by: ['locationId'],
        })
        .then((result) => result.length),

      // Unique item types
      this.prisma.marketOrderTrade
        .groupBy({
          by: ['typeId'],
        })
        .then((result) => result.length),

      // Date range
      this.prisma.marketOrderTrade.aggregate({
        _min: { scanDate: true },
        _max: { scanDate: true },
      }),

      // Recent activity (last 24 hours)
      this.prisma.marketOrderTrade.count({
        where: {
          scanDate: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalRecords,
      uniqueStations,
      uniqueItems,
      dateRange: {
        earliest: dateRange._min.scanDate,
        latest: dateRange._max.scanDate,
      },
      recentActivity: {
        last24Hours: recentActivity,
      },
      lastUpdated: new Date(),
    };
  }
}
