import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackedStationService } from './tracked-station.service';
import { Decimal } from '@prisma/client/runtime/library';
import * as fs from 'fs';

import { parse } from 'csv-parse/sync';
import {
  MarketDataCsvRow,
  ProcessedMarketDataRow,
  MarketDataImportStats,
  MarketDataFilters,
} from './interfaces/market-data.interface';
import { MarketOrderTradeDto } from './dto/market-data.dto';
import { getErrorMessage } from '../common/interfaces/error.interface';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    private prisma: PrismaService,
    private trackedStationService: TrackedStationService,
  ) {}

  async importMarketDataFromFile(
    filePath: string,
  ): Promise<MarketDataImportStats> {
    this.logger.log(`Starting market data import from ${filePath}`);

    const stats: MarketDataImportStats = {
      totalProcessed: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      trackedStationsFound: 0,
      startTime: new Date(),
      endTime: new Date(),
    };

    try {
      // Get list of tracked station IDs
      const trackedStationIds =
        await this.trackedStationService.getActiveStationIds();
      const trackedStationSet = new Set(
        trackedStationIds.map((id) => id.toString()),
      );

      this.logger.log(
        `Found ${trackedStationIds.length} active tracked stations`,
      );

      if (trackedStationIds.length === 0) {
        this.logger.warn('No tracked stations found, no data will be imported');
        stats.endTime = new Date();
        return stats;
      }

      // Read and parse CSV file
      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const rows: MarketDataCsvRow[] = parse(csvContent, {
        columns: true,
        delimiter: ';',
        skip_empty_lines: true,
      });

      this.logger.log(`Parsed ${rows.length} rows from CSV`);

      // Process rows in batches
      const batchSize = 1000;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await this.processBatch(batch, trackedStationSet, stats);

        this.logger.log(
          `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)} ` +
            `(${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors)`,
        );
      }

      stats.endTime = new Date();
      this.logger.log(
        `Market data import completed: ${stats.imported} imported, ` +
          `${stats.skipped} skipped, ${stats.errors} errors ` +
          `in ${stats.endTime.getTime() - stats.startTime.getTime()}ms`,
      );

      return stats;
    } catch (error) {
      stats.endTime = new Date();
      this.logger.error(`Market data import failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private async processBatch(
    batch: MarketDataCsvRow[],
    trackedStationSet: Set<string>,
    stats: MarketDataImportStats,
  ): Promise<void> {
    const processedRows: ProcessedMarketDataRow[] = [];

    for (const row of batch) {
      stats.totalProcessed++;

      try {
        // Check if this location is a tracked station
        if (!trackedStationSet.has(row.location_id)) {
          stats.skipped++;
          continue;
        }

        stats.trackedStationsFound++;

        // Parse and validate data
        const processedRow = this.parseMarketDataRow(row);
        processedRows.push(processedRow);
      } catch (error) {
        stats.errors++;
        this.logger.warn(
          `Failed to process row for location ${row.location_id}: ${getErrorMessage(error)}`,
        );
      }
    }

    // Bulk insert processed rows
    if (processedRows.length > 0) {
      try {
        const operations = processedRows.map((row) =>
          this.prisma.marketOrderTrade.upsert({
            where: {
              locationId_typeId_scanDate_isBuyOrder: {
                locationId: row.locationId,
                typeId: row.typeId,
                scanDate: row.scanDate,
                isBuyOrder: row.isBuyOrder,
              },
            },
            update: {
              amount: row.amount,
              high: row.high,
              low: row.low,
              avg: row.avg,
              orderNum: row.orderNum,
              iskValue: row.iskValue,
              hasGone: row.hasGone,
            },
            create: {
              locationId: row.locationId,
              regionId: row.regionId,
              typeId: row.typeId,
              isBuyOrder: row.isBuyOrder,
              hasGone: row.hasGone,
              scanDate: row.scanDate,
              amount: row.amount,
              high: row.high,
              low: row.low,
              avg: row.avg,
              orderNum: row.orderNum,
              iskValue: row.iskValue,
            },
          }),
        );

        await this.prisma.$transaction(operations);
        stats.imported += processedRows.length;
      } catch (error) {
        this.logger.error(`Failed to insert batch: ${getErrorMessage(error)}`);
        stats.errors += processedRows.length;
      }
    }
  }

  private parseMarketDataRow(row: MarketDataCsvRow): ProcessedMarketDataRow {
    return {
      locationId: BigInt(row.location_id),
      regionId: parseInt(row.region_id),
      typeId: parseInt(row.type_id),
      isBuyOrder: row.is_buy_order === '1',
      hasGone: row.has_gone === '1',
      scanDate: new Date(row.scanDate),
      amount: BigInt(row.amount),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      avg: parseFloat(row.avg),
      orderNum: parseInt(row.orderNum),
      iskValue: BigInt(row.iskValue),
    };
  }

  async queryMarketData(
    filters: MarketDataFilters,
  ): Promise<MarketOrderTradeDto[]> {
    const where: {
      locationId?: { in: bigint[] };
      typeId?: { in: number[] };
      scanDate?: { gte?: Date; lte?: Date };
      isBuyOrder?: boolean;
    } = {};

    if (filters.stationIds && filters.stationIds.length > 0) {
      where.locationId = { in: filters.stationIds };
    }

    if (filters.typeIds && filters.typeIds.length > 0) {
      where.typeId = { in: filters.typeIds };
    }

    if (filters.startDate || filters.endDate) {
      where.scanDate = {};
      if (filters.startDate) {
        where.scanDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.scanDate.lte = filters.endDate;
      }
    }

    if (filters.isBuyOrder !== undefined) {
      where.isBuyOrder = filters.isBuyOrder;
    }

    const trades = await this.prisma.marketOrderTrade.findMany({
      where,
      include: {
        region: { select: { name: true } },
        itemType: { select: { name: true } },
        station: { select: { name: true } },
      },
      orderBy: { scanDate: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });

    return trades.map((trade) => this.toDto(trade));
  }

  async getMarketDataStats() {
    const [total, dateRange, byStation, byItemType] = await Promise.all([
      this.prisma.marketOrderTrade.count(),

      this.prisma.marketOrderTrade.aggregate({
        _min: { scanDate: true },
        _max: { scanDate: true },
      }),

      this.prisma.marketOrderTrade.groupBy({
        by: ['locationId'],
        where: { isBuyOrder: false }, // Only sell order completions
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      this.prisma.marketOrderTrade.groupBy({
        by: ['typeId'],
        where: { isBuyOrder: false }, // Only sell order completions
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    // Enrich station data
    const stationDetails = await Promise.all(
      byStation.map(async (item) => {
        const station = await this.prisma.station.findUnique({
          where: { id: item.locationId },
          select: { name: true },
        });
        return {
          stationId: item.locationId.toString(),
          stationName: station?.name || 'Unknown Station',
          recordCount: item._count.id,
        };
      }),
    );

    // Enrich item type data
    const itemTypeDetails = await Promise.all(
      byItemType.map(async (item) => {
        const itemType = await this.prisma.itemType.findUnique({
          where: { id: item.typeId },
          select: { name: true },
        });
        return {
          typeId: item.typeId,
          typeName: itemType?.name || 'Unknown Item',
          recordCount: item._count.id,
        };
      }),
    );

    return {
      totalRecords: total,
      dateRange: {
        earliest: dateRange._min.scanDate?.toISOString() || '',
        latest: dateRange._max.scanDate?.toISOString() || '',
      },
      byStation: stationDetails,
      byItemType: itemTypeDetails,
    };
  }

  private toDto(trade: {
    id: number;
    locationId: bigint;
    regionId: number;
    typeId: number;
    isBuyOrder: boolean;
    hasGone: boolean;
    scanDate: Date;
    amount: bigint;
    high: Decimal;
    low: Decimal;
    avg: Decimal;
    orderNum: number;
    iskValue: bigint;
    region?: { name: string } | null;
    itemType?: { name: string } | null;
    station?: { name: string } | null;
  }): MarketOrderTradeDto {
    return {
      id: trade.id,
      locationId: trade.locationId.toString(),
      regionId: trade.regionId,
      typeId: trade.typeId,
      isBuyOrder: trade.isBuyOrder,
      hasGone: trade.hasGone,
      scanDate: trade.scanDate.toISOString(),
      amount: trade.amount.toString(),
      high: trade.high.toString(),
      low: trade.low.toString(),
      avg: trade.avg.toString(),
      orderNum: trade.orderNum,
      iskValue: trade.iskValue.toString(),
      regionName: trade.region?.name,
      itemTypeName: trade.itemType?.name,
      stationName: trade.station?.name,
    };
  }
}
