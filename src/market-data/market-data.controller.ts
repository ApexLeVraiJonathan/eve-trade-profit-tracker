import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { LiquidityAnalyzerService } from './liquidity-analyzer.service';
import {
  MarketDataImportResultDto,
  MarketDataStatsDto,
  MarketDataQueryDto,
  MarketDataQueryResultDto,
} from './dto/market-data.dto';
import { ErrorResponseDto } from '../reference-data/dto/reference-data.dto';
import { getErrorMessage } from '../common/interfaces/error.interface';
import * as path from 'path';
import * as fs from 'fs';

@Controller('market-data')
export class MarketDataController {
  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly liquidityAnalyzer: LiquidityAnalyzerService,
  ) {}

  @Post('import')
  async importMarketDataFromFile(
    @Body() body: { filePath: string },
  ): Promise<MarketDataImportResultDto | ErrorResponseDto> {
    try {
      const stats = await this.marketDataService.importMarketDataFromFile(
        body.filePath,
      );

      const duration = `${stats.endTime.getTime() - stats.startTime.getTime()}ms`;

      return {
        success: true,
        message: 'Market data import completed successfully',
        data: {
          totalProcessed: stats.totalProcessed,
          imported: stats.imported,
          skipped: stats.skipped,
          errors: stats.errors,
          trackedStationsFound: stats.trackedStationsFound,
          importDuration: duration,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Market data import failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Post('import-sample')
  async importSampleData(): Promise<
    MarketDataImportResultDto | ErrorResponseDto
  > {
    // Import the sample data file from doc folder
    const sampleFilePath = path.resolve(
      'doc',
      'marketOrderTrades_daily_2025-07-29.csv',
    );

    if (!fs.existsSync(sampleFilePath)) {
      return {
        success: false,
        message: 'Sample data file not found',
      };
    }

    try {
      const stats =
        await this.marketDataService.importMarketDataFromFile(sampleFilePath);

      const duration = `${stats.endTime.getTime() - stats.startTime.getTime()}ms`;

      return {
        success: true,
        message: 'Sample market data import completed successfully',
        data: {
          totalProcessed: stats.totalProcessed,
          imported: stats.imported,
          skipped: stats.skipped,
          errors: stats.errors,
          trackedStationsFound: stats.trackedStationsFound,
          importDuration: duration,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Sample data import failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('query')
  async queryMarketData(
    @Query() queryDto: MarketDataQueryDto,
  ): Promise<MarketDataQueryResultDto | ErrorResponseDto> {
    try {
      const filters = {
        stationIds: queryDto.stationIds?.map((id) => BigInt(id)),
        typeIds: queryDto.typeIds,
        startDate: queryDto.startDate
          ? new Date(queryDto.startDate)
          : undefined,
        endDate: queryDto.endDate ? new Date(queryDto.endDate) : undefined,
        isBuyOrder: queryDto.isBuyOrder,
        limit: queryDto.limit || 100,
        offset: queryDto.offset || 0,
      };

      const trades = await this.marketDataService.queryMarketData(filters);

      // Get total count for pagination (simplified)
      const total = trades.length;
      const hasMore = total >= (filters.limit || 100);

      return {
        success: true,
        data: {
          trades,
          pagination: {
            total,
            limit: filters.limit || 100,
            offset: filters.offset || 0,
            hasMore,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Market data query failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('stats')
  async getMarketDataStats(): Promise<MarketDataStatsDto> {
    const stats = await this.marketDataService.getMarketDataStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('latest')
  async getLatestMarketData(
    @Query('limit') limit?: number,
  ): Promise<MarketDataQueryResultDto | ErrorResponseDto> {
    try {
      const filters = {
        limit: limit || 50,
        offset: 0,
      };

      const trades = await this.marketDataService.queryMarketData(filters);

      return {
        success: true,
        data: {
          trades,
          pagination: {
            total: trades.length,
            limit: filters.limit,
            offset: 0,
            hasMore: trades.length >= filters.limit,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get latest market data: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('liquidity/report')
  async getLiquidityReport(
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const report = await this.liquidityAnalyzer.getLiquidityReport(
        limit ? parseInt(limit.toString()) : 50,
      );

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate liquidity report: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('liquidity/high-frequency-items')
  async getHighFrequencyItems(
    @Query('minHubCount') minHubCount?: number,
    @Query('minTotalTrades') minTotalTrades?: number,
    @Query('minValue') minValue?: number,
    @Query('maxDaysStale') maxDaysStale?: number,
    @Query('minLiquidityScore') minLiquidityScore?: number,
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const criteria = {
        minHubCount: minHubCount ? parseInt(minHubCount.toString()) : undefined,
        minTotalTrades: minTotalTrades
          ? parseInt(minTotalTrades.toString())
          : undefined,
        minValue: minValue ? parseInt(minValue.toString()) : undefined,
        maxDaysStale: maxDaysStale
          ? parseInt(maxDaysStale.toString())
          : undefined,
        minLiquidityScore: minLiquidityScore
          ? parseInt(minLiquidityScore.toString())
          : undefined,
      };

      const highLiquidityItems =
        await this.liquidityAnalyzer.getHighLiquidityItems(criteria);

      return {
        success: true,
        data: {
          itemTypeIds: highLiquidityItems,
          count: highLiquidityItems.length,
          criteria,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get high-frequency items: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('liquidity/top-items-ids')
  async getTopItemIds(
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const report = await this.liquidityAnalyzer.getLiquidityReport(
        limit ? parseInt(limit.toString()) : 50,
      );

      const topItemIds = report.topItems.map((item) => item.itemTypeId);

      return {
        success: true,
        data: {
          itemTypeIds: topItemIds,
          count: topItemIds.length,
          summary: report.summary,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get top item IDs: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('liquidity/test-criteria')
  async testLiquidityCriteria(
    @Query('minTotalTrades') minTotalTrades?: string,
    @Query('minValue') minValue?: string,
    @Query('maxDaysStale') maxDaysStale?: string,
    @Query('minHubCount') minHubCount?: string,
  ): Promise<{
    success: boolean;
    requestedCriteria?: any;
    tests?: any;
    recommendation?: any;
    message?: string;
  }> {
    try {
      const criteria = {
        minTotalTrades: minTotalTrades ? parseInt(minTotalTrades) : 8,
        minValue: minValue ? parseInt(minValue) : 1000000, // 1M ISK default
        maxDaysStale: maxDaysStale ? parseInt(maxDaysStale) : 7,
        minHubCount: minHubCount ? parseInt(minHubCount) : 1, // Single hub OK
      };

      // Test different thresholds
      const tests = [
        { name: 'Current Settings', ...criteria },
        { name: 'Lower Trades (5)', ...criteria, minTotalTrades: 5 },
        { name: 'Higher Trades (15)', ...criteria, minTotalTrades: 15 },
        { name: 'Lower Value (500k)', ...criteria, minValue: 500000 },
        { name: 'Higher Value (5M)', ...criteria, minValue: 5000000 },
        { name: 'Multi-Hub Required', ...criteria, minHubCount: 2 },
      ];

      const results: Array<{
        criteria: any;
        itemCount: number;
        estimatedApiCalls: number;
        sampleItems: number[];
      }> = [];

      for (const test of tests) {
        const itemIds = await this.liquidityAnalyzer.getHighLiquidityItems({
          minTotalTrades: test.minTotalTrades,
          minValue: test.minValue,
          maxDaysStale: test.maxDaysStale,
          minHubCount: test.minHubCount,
          minLiquidityScore: 0, // Ignore composite score as requested
        });

        results.push({
          criteria: test,
          itemCount: itemIds.length,
          estimatedApiCalls: itemIds.length * 5, // items × 5 regions
          sampleItems: itemIds.slice(0, 5), // Show first 5 item IDs for verification
        });
      }

      return {
        success: true,
        requestedCriteria: criteria,
        tests: results,
        recommendation: {
          note: 'Aim for <5000 API calls total (1000 items × 5 regions)',
          performance: results.map((r) => ({
            name: r.criteria.name,
            items: r.itemCount,
            apiCalls: r.estimatedApiCalls,
            performance: r.estimatedApiCalls < 5000 ? '✅ Fast' : '⚠️ Slow',
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to test liquidity criteria: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('liquidity/debug-raw')
  async debugRawData(
    @Query('stationId') stationId: string,
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      // Use the liquidityAnalyzer to test raw database access
      const result = await this.liquidityAnalyzer.debugRawStationData(
        BigInt(stationId),
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to debug raw data: ${error.message}`,
      };
    }
  }

  @Get('liquidity/debug-destination')
  async debugDestinationLiquidity(
    @Query('stationId') stationId: string,
    @Query('minTotalTrades') minTotalTrades?: string,
    @Query('minValue') minValue?: string,
    @Query('maxDaysStale') maxDaysStale?: string,
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const stationIdBigInt = BigInt(stationId);
      const criteria = {
        minTotalTrades: minTotalTrades ? parseInt(minTotalTrades) : 12,
        minValue: minValue ? parseInt(minValue) : 1000000,
        maxDaysStale: maxDaysStale ? parseInt(maxDaysStale) : 7,
        minHubCount: 1,
        minLiquidityScore: 0,
      };

      // Test different criteria to see what works
      const tests = [
        { name: 'Current Criteria', ...criteria },
        { name: 'Lower Trades (5)', ...criteria, minTotalTrades: 5 },
        { name: 'Lower Value (100k)', ...criteria, minValue: 100000 },
        { name: 'Longer Period (30 days)', ...criteria, maxDaysStale: 30 },
        {
          name: 'Very Relaxed',
          minTotalTrades: 1,
          minValue: 1000,
          maxDaysStale: 30,
          minHubCount: 1,
          minLiquidityScore: 0,
        },
      ];

      const results: Array<{
        criteria: any;
        liquidItemCount: number;
        sampleItems: number[];
      }> = [];

      for (const test of tests) {
        const liquidItems =
          await this.liquidityAnalyzer.getDestinationLiquidity(
            stationIdBigInt,
            test,
          );
        results.push({
          criteria: test,
          liquidItemCount: liquidItems.length,
          sampleItems: liquidItems.slice(0, 5),
        });
      }

      return {
        success: true,
        data: {
          stationId: stationId,
          tests: results,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to debug destination liquidity: ${error}`,
      };
    }
  }
}
