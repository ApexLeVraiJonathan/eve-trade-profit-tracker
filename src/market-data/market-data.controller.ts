import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { LiquidityAnalyzerService } from './liquidity-analyzer.service';
import {
  MarketDataImportResultDto,
  MarketDataStatsDto,
  MarketDataQueryDto,
  MarketDataQueryResultDto,
  MarketDataResponseDto,
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

  @Get('liquidity/debug-raw')
  async debugRawData(
    @Query('stationId') stationId: string,
  ): Promise<MarketDataResponseDto> {
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
        message: `Failed to debug raw data: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('liquidity/debug-destination')
  async debugDestinationLiquidity(
    @Query('stationId') stationId: string,
    @Query('minDaysPerWeek') minDaysPerWeek?: string,
    @Query('minValue') minValue?: string,
  ): Promise<MarketDataResponseDto> {
    try {
      const stationIdBigInt = BigInt(stationId);
      const criteria = {
        minDaysPerWeek: minDaysPerWeek ? parseInt(minDaysPerWeek) : 4, // 4+ days per week
        minValue: minValue ? parseInt(minValue) : 1000000,
      };

      // Test different criteria to see what works with days-per-week logic
      const tests = [
        { name: 'Current Criteria (4+ days)', ...criteria },
        { name: 'Less Active (3+ days)', ...criteria, minDaysPerWeek: 3 },
        { name: 'Lower Value (100k)', ...criteria, minValue: 100000 },
        { name: 'Very Active (5+ days)', ...criteria, minDaysPerWeek: 5 },
        {
          name: 'Very Relaxed (1+ day)',
          minDaysPerWeek: 1,
          minValue: 1000,
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
          sampleItems: liquidItems.slice(0, 5).map((item) => item.typeId),
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
