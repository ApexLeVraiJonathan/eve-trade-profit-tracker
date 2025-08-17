import { Controller, Get, Query, Param, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { LiquidityAnalyzerService } from './liquidity-analyzer.service';
import { MarketQueryService } from './market-query.service';
import {
  LiquidityQueryDto,
  MultiStationLiquidityQueryDto,
  LiquidityResponseDto,
  MultiStationLiquidityResponseDto,
  StationDebugResponseDto,
} from './dto/analytics.dto';
import {
  MarketDataQueryDto,
  MarketDataQueryResultDto,
  MarketDataStatsDto,
} from '../common/dto/market-data.dto';
import { ErrorResponseDto } from '../common/dto/common-response.dto';
import { getErrorMessage } from '../common/interfaces/error.interface';

@ApiTags('market-analytics')
@Controller('analytics')
export class MarketAnalyticsController {
  private readonly logger = new Logger(MarketAnalyticsController.name);

  constructor(
    private readonly liquidityAnalyzer: LiquidityAnalyzerService,
    private readonly marketQueryService: MarketQueryService,
  ) {}

  @Get('liquidity/:stationId')
  @ApiOperation({
    summary: 'Analyze item liquidity for a specific station',
    description:
      'Find items that are actively traded at a station based on days-per-week and value criteria',
  })
  @ApiParam({
    name: 'stationId',
    description: 'Station ID to analyze (e.g. Jita = 60003760)',
    example: '60003760',
  })
  @ApiQuery({
    name: 'minDaysPerWeek',
    description: 'Minimum days per week an item must trade',
    required: false,
    example: 4,
  })
  @ApiQuery({
    name: 'minValue',
    description: 'Minimum average ISK value per week',
    required: false,
    example: 1000000,
  })
  @ApiResponse({
    status: 200,
    description: 'Liquidity analysis completed successfully',
    type: LiquidityResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid station ID or parameters',
  })
  async getStationLiquidity(
    @Param('stationId') stationId: string,
    @Query() query: Partial<LiquidityQueryDto>,
  ): Promise<LiquidityResponseDto | ErrorResponseDto> {
    try {
      this.logger.log(`Analyzing liquidity for station ${stationId}`);

      const stationIdBigInt = BigInt(stationId);
      const criteria = {
        minDaysPerWeek: query.minDaysPerWeek || 4,
        minValue: query.minValue || 1000000,
      };

      const liquidItems = await this.liquidityAnalyzer.getDestinationLiquidity(
        stationIdBigInt,
        criteria,
      );

      return {
        success: true,
        data: liquidItems,
        metadata: {
          stationId,
          analysisWindow: '7 days',
          totalItemsAnalyzed: liquidItems.length,
          liquidItemsFound: liquidItems.length,
          criteria,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze liquidity for station ${stationId}`,
        error,
      );
      return {
        success: false,
        message: `Liquidity analysis failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('liquidity/multi-station')
  @ApiOperation({
    summary: 'Compare liquidity across multiple stations',
    description:
      'Analyze and compare item liquidity across multiple trading hubs',
  })
  @ApiQuery({
    name: 'stationIds',
    description: 'Comma-separated station IDs (e.g. "60003760,60008494")',
    example: '60003760,60008494,60011866',
  })
  @ApiQuery({
    name: 'minDaysPerWeek',
    description: 'Minimum days per week an item must trade',
    required: false,
    example: 4,
  })
  @ApiQuery({
    name: 'minValue',
    description: 'Minimum average ISK value per week',
    required: false,
    example: 1000000,
  })
  @ApiResponse({
    status: 200,
    description: 'Multi-station liquidity analysis completed',
    type: MultiStationLiquidityResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid station IDs or parameters',
  })
  async getMultiStationLiquidity(
    @Query() query: MultiStationLiquidityQueryDto,
  ): Promise<MultiStationLiquidityResponseDto | ErrorResponseDto> {
    try {
      const stationIdStrings = query.stationIds
        .split(',')
        .map((id) => id.trim());
      const stationIds = stationIdStrings.map((id) => BigInt(id));

      this.logger.log(
        `Analyzing liquidity across ${stationIds.length} stations`,
      );

      const criteria = {
        minDaysPerWeek: query.minDaysPerWeek || 4,
        minValue: query.minValue || 1000000,
      };

      const liquidityData =
        await this.liquidityAnalyzer.analyzeMultiStationLiquidity(
          stationIds,
          criteria,
        );

      const totalLiquidItems = Object.values(liquidityData).reduce(
        (total, items) => total + items.length,
        0,
      );

      return {
        success: true,
        data: liquidityData,
        metadata: {
          stationsAnalyzed: stationIds.length,
          totalLiquidItems,
          criteria,
        },
      };
    } catch (error) {
      this.logger.error('Failed to analyze multi-station liquidity', error);
      return {
        success: false,
        message: `Multi-station liquidity analysis failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('debug/station/:stationId')
  @ApiOperation({
    summary: 'Debug station trading data',
    description:
      'Get raw trading statistics and sample data for troubleshooting',
  })
  @ApiParam({
    name: 'stationId',
    description: 'Station ID to debug',
    example: '60003760',
  })
  @ApiResponse({
    status: 200,
    description: 'Debug data retrieved successfully',
    type: StationDebugResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid station ID',
  })
  async debugStation(
    @Param('stationId') stationId: string,
  ): Promise<StationDebugResponseDto | ErrorResponseDto> {
    try {
      this.logger.debug(`Getting debug data for station ${stationId}`);

      const stationIdBigInt = BigInt(stationId);
      const debugData =
        await this.liquidityAnalyzer.debugRawStationData(stationIdBigInt);

      return {
        success: true,
        data: debugData,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get debug data for station ${stationId}`,
        error,
      );
      return {
        success: false,
        message: `Debug data retrieval failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('market-data/query')
  @ApiOperation({
    summary: 'Query historical market data',
    description:
      'Search and filter historical market trade data with pagination',
  })
  @ApiQuery({
    name: 'stationIds',
    description: 'Comma-separated station IDs to filter by',
    required: false,
    example: '60003760,60008494',
  })
  @ApiQuery({
    name: 'typeIds',
    description: 'Comma-separated item type IDs to filter by',
    required: false,
    example: '34,35',
  })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date for filtering (ISO string)',
    required: false,
    example: '2025-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date for filtering (ISO string)',
    required: false,
    example: '2025-01-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'isBuyOrder',
    description: 'Filter by order type (true for buy orders, false for sell)',
    required: false,
    example: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of records to return',
    required: false,
    example: 100,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Number of records to skip for pagination',
    required: false,
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Market data query completed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async queryMarketData(
    @Query() queryDto: MarketDataQueryDto,
  ): Promise<MarketDataQueryResultDto | ErrorResponseDto> {
    try {
      this.logger.debug(
        `Querying market data with filters: ${JSON.stringify(queryDto)}`,
      );

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

      const trades = await this.marketQueryService.queryMarketData(filters);

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
      this.logger.error('Market data query failed', error);
      return {
        success: false,
        message: `Market data query failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('market-data/stats')
  @ApiOperation({
    summary: 'Get market data statistics',
    description:
      'Retrieve comprehensive statistics about the stored market data',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to retrieve statistics',
  })
  async getMarketDataStats(): Promise<MarketDataStatsDto> {
    this.logger.debug('Getting market data statistics');
    const stats = await this.marketQueryService.getMarketDataStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('market-data/latest')
  @ApiOperation({
    summary: 'Get latest market data',
    description: 'Retrieve the most recent market trade records',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of records to return',
    required: false,
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Latest market data retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getLatestMarketData(
    @Query('limit') limit?: number,
  ): Promise<MarketDataQueryResultDto | ErrorResponseDto> {
    try {
      this.logger.debug(`Getting latest market data (limit: ${limit || 50})`);

      const filters = {
        limit: limit || 50,
        offset: 0,
      };

      const trades = await this.marketQueryService.queryMarketData(filters);

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
      this.logger.error('Failed to get latest market data', error);
      return {
        success: false,
        message: `Failed to get latest market data: ${getErrorMessage(error)}`,
      };
    }
  }
}
