import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArbitrageService } from './arbitrage.service';
import { ArbitrageOpportunity } from './interfaces/arbitrage.interface';
import {
  ArbitrageOpportunitiesDto,
  ArbitrageOpportunityDto,
  ArbitrageFiltersDto,
  ArbitrageSummaryDto,
  ArbitrageErrorDto,
} from './dto/arbitrage.dto';
import {
  ArbitrageQueryParams,
  ArbitrageSummaryQueryParams,
  parseOptionalFloat,
  parseOptionalInt,
  parseOptionalBoolean,
  isValidSortBy,
  isValidSortOrder,
} from './interfaces/query.interface';

@ApiTags('arbitrage')
@Controller('arbitrage')
export class ArbitrageController {
  private readonly logger = new Logger(ArbitrageController.name);

  constructor(private readonly arbitrageService: ArbitrageService) {}

  @Get('opportunities')
  async getMultiHubArbitrageOpportunities(
    @Query() filtersQuery: ArbitrageQueryParams,
  ): Promise<ArbitrageOpportunitiesDto | ArbitrageErrorDto> {
    try {
      // Parse hub parameters with smart defaults
      const sourceHub =
        filtersQuery.sourceHub || filtersQuery.fromHub || 'jita';
      const destinationHubs = filtersQuery.destinationHubs
        ? filtersQuery.destinationHubs
            .split(',')
            .map((h) => h.trim().toLowerCase())
        : filtersQuery.toHub
          ? [filtersQuery.toHub.toLowerCase()]
          : ['amarr', 'dodixie', 'rens', 'hek']; // Default to major trade hubs

      this.logger.log(
        `Fetching multi-hub arbitrage opportunities: ${sourceHub} → [${destinationHubs.join(', ')}]`,
      );

      // Validate hubs
      const availableHubs = this.arbitrageService
        .getAvailableTradingHubs()
        .map((h) => h.name);

      if (!availableHubs.includes(sourceHub.toLowerCase())) {
        return {
          success: false,
          error: `Invalid source hub: ${sourceHub}. Available hubs: ${availableHubs.join(', ')}`,
          timestamp: new Date().toISOString(),
        };
      }

      for (const hub of destinationHubs) {
        if (!availableHubs.includes(hub)) {
          return {
            success: false,
            error: `Invalid destination hub: ${hub}. Available hubs: ${availableHubs.join(', ')}`,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Parse filters
      const filters: ArbitrageFiltersDto = {
        minProfit: parseOptionalFloat(filtersQuery.minProfit),
        minMarginPercent: parseOptionalFloat(filtersQuery.minMarginPercent),
        maxCargoVolume: parseOptionalFloat(filtersQuery.maxCargoVolume),
        maxInvestment: parseOptionalFloat(filtersQuery.maxInvestment),
        minProfitPerM3: parseOptionalFloat(filtersQuery.minProfitPerM3),
        excludeHighRisk: parseOptionalBoolean(filtersQuery.excludeHighRisk),
        limit: parseOptionalInt(filtersQuery.limit) ?? 50,
        sortBy: isValidSortBy(filtersQuery.sortBy)
          ? filtersQuery.sortBy
          : 'margin',
        sortOrder: isValidSortOrder(filtersQuery.sortOrder)
          ? filtersQuery.sortOrder
          : 'desc',
      };

      // Call the new multi-hub service method
      const opportunities: ArbitrageOpportunity[] =
        await this.arbitrageService.findMultiHubArbitrageOpportunities({
          sourceHub: sourceHub.toLowerCase(),
          destinationHubs,
          filters,
        });

      // Calculate summary using new streamlined format
      const totalPotentialProfit = opportunities.reduce(
        (sum, opp) => sum + opp.possibleProfit,
        0,
      );

      const averageMargin =
        opportunities.length > 0
          ? opportunities.reduce((sum, opp) => sum + opp.margin, 0) /
            opportunities.length
          : 0;

      // NEW STREAMLINED DTO FORMAT - exactly what user requested
      const opportunityDtos: ArbitrageOpportunityDto[] = opportunities.map(
        (opp) => ({
          // Core item info
          itemTypeName: opp.itemTypeName,

          // Hub routing (solar system names)
          fromHub: opp.fromHub,
          toHub: opp.toHub,

          // Key metrics for trading decisions
          margin: Math.round(opp.margin * 100) / 100, // Round to 2 decimal places
          possibleProfit: Math.round(opp.possibleProfit),
          daysTraded: opp.daysTraded,
          totalAmountTradedPerWeek: opp.totalAmountTradedPerWeek,
          iskPerM3: Math.round(opp.iskPerM3),

          // Historical price data from actual trades at destination
          recordedPriceLow: opp.recordedPriceLow ?? 0,
          recordedPriceHigh: opp.recordedPriceHigh ?? 0,
          recordedPriceAverage: opp.recordedPriceAverage ?? 0,

          // DEBUG: Source and destination prices for verification
          buyPrice: opp.details?.costs.buyPrice ?? 0,
          sellPrice: opp.details?.costs.sellPrice ?? 0,
        }),
      );

      // Build applied filters list
      const appliedFilters: string[] = [];
      if (filters.minProfit)
        appliedFilters.push(`Min Profit: ${filters.minProfit} ISK`);
      if (filters.minMarginPercent)
        appliedFilters.push(`Min Margin: ${filters.minMarginPercent}%`);
      if (filters.maxCargoVolume)
        appliedFilters.push(`Max Cargo: ${filters.maxCargoVolume} m³`);
      if (filters.maxInvestment)
        appliedFilters.push(`Max Investment: ${filters.maxInvestment} ISK`);
      if (filters.excludeHighRisk) appliedFilters.push('Exclude High Risk');

      return {
        success: true,
        data: {
          opportunities: opportunityDtos,
          summary: {
            totalOpportunities: opportunities.length,
            totalPotentialProfit: totalPotentialProfit.toString(),
            averageMargin: Math.round(averageMargin * 100) / 100,
            calculatedAt: new Date().toISOString(),
          },
          filters: {
            ...filters,
            appliedFilters,
          },
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        'Failed to fetch arbitrage opportunities:',
        errorMessage,
      );

      return {
        success: false,
        error: 'Failed to fetch arbitrage opportunities',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('hubs')
  getAvailableTradingHubs(): {
    success: boolean;
    data: Array<{
      name: string;
      systemName: string;
      fullStationName: string;
      stationId: string;
    }>;
    message?: string;
  } {
    try {
      const hubs = this.arbitrageService.getAvailableTradingHubs();

      return {
        success: true,
        data: hubs.map((hub) => ({
          name: hub.name,
          systemName: hub.systemName,
          fullStationName: hub.fullStationName,
          stationId: hub.stationId.toString(),
        })),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to fetch trading hubs', errorMessage);

      return {
        success: false,
        data: [],
        message: 'Failed to fetch available trading hubs',
      };
    }
  }

  @Get('opportunities/route')
  async getRouteArbitrageOpportunities(
    @Query('sourceHub') sourceHub: string,
    @Query('destHub') destHub: string,
    @Query() filtersQuery: ArbitrageQueryParams,
  ): Promise<ArbitrageOpportunitiesDto | ArbitrageErrorDto> {
    try {
      this.logger.log(
        `Fetching arbitrage opportunities for route: ${sourceHub} → ${destHub}`,
      );

      // Get hub information using centralized service
      const sourceHubInfo = this.arbitrageService.getTradingHub(sourceHub);
      const destHubInfo = this.arbitrageService.getTradingHub(destHub);

      const availableHubs = this.arbitrageService
        .getAvailableTradingHubs()
        .map((h) => h.name);

      if (!sourceHubInfo || !destHubInfo) {
        return {
          success: false,
          error: `Invalid hub names. Available hubs: ${availableHubs.join(', ')}`,
          timestamp: new Date().toISOString(),
        };
      }

      const sourceStationId = sourceHubInfo.stationId;
      const destStationId = destHubInfo.stationId;

      // Parse query parameters into filters (NO hub filtering - route is already specific)
      const filters: ArbitrageFiltersDto = {
        minProfit: parseOptionalFloat(filtersQuery.minProfit),
        minMarginPercent: parseOptionalFloat(filtersQuery.minMarginPercent),
        maxCargoVolume: parseOptionalFloat(filtersQuery.maxCargoVolume),
        maxInvestment: parseOptionalFloat(filtersQuery.maxInvestment),
        minProfitPerM3: parseOptionalFloat(filtersQuery.minProfitPerM3),
        excludeHighRisk: parseOptionalBoolean(filtersQuery.excludeHighRisk),
        limit: parseOptionalInt(filtersQuery.limit) ?? 50,
        sortBy: isValidSortBy(filtersQuery.sortBy)
          ? filtersQuery.sortBy
          : 'margin',
        sortOrder: isValidSortOrder(filtersQuery.sortOrder)
          ? filtersQuery.sortOrder
          : 'desc',
        // fromHub: sourceHub,  // Removed - redundant for route endpoint
        // toHub: destHub,      // Removed - redundant for route endpoint
      };

      // Get route-specific arbitrage opportunities
      const opportunities =
        await this.arbitrageService.findRouteArbitrageOpportunities(
          sourceStationId,
          destStationId,
          filters,
        );

      // Calculate summary statistics
      const totalPotentialProfit = opportunities.reduce(
        (sum, opp) => sum + opp.possibleProfit,
        0,
      );
      const averageMargin =
        opportunities.length > 0
          ? opportunities.reduce((sum, opp) => sum + opp.margin, 0) /
            opportunities.length
          : 0;

      // Convert to DTOs
      const opportunityDtos = opportunities.map((opp) => ({
        itemTypeName: opp.itemTypeName,
        fromHub: opp.fromHub,
        toHub: opp.toHub,
        margin: Math.round(opp.margin * 100) / 100,
        possibleProfit: Math.round(opp.possibleProfit),
        daysTraded: opp.daysTraded,
        totalAmountTradedPerWeek: opp.totalAmountTradedPerWeek,
        iskPerM3: Math.round(opp.iskPerM3),
        buyPrice: opp.details?.costs.buyPrice ?? 0,
        sellPrice: opp.details?.costs.sellPrice ?? 0,
      }));

      return {
        success: true,
        data: {
          opportunities: opportunityDtos as ArbitrageOpportunityDto[],
          summary: {
            totalOpportunities: opportunities.length,
            totalPotentialProfit: totalPotentialProfit.toString(),
            averageMargin: Math.round(averageMargin * 100) / 100,
            calculatedAt: new Date().toISOString(),
          },
          filters: {
            ...filters,
            appliedFilters: [`Route: ${sourceHub} → ${destHub}`],
          },
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to fetch route arbitrage opportunities: ${errorMessage}`,
      );

      return {
        success: false,
        error: 'Failed to fetch route arbitrage opportunities',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('summary')
  async getArbitrageSummary(
    @Query() filtersQuery: ArbitrageSummaryQueryParams,
  ): Promise<ArbitrageSummaryDto | ArbitrageErrorDto> {
    try {
      this.logger.log('Generating arbitrage summary...');

      // Parse basic filters
      const filters: ArbitrageFiltersDto = {
        minProfit: parseOptionalFloat(filtersQuery.minProfit),
        minMarginPercent: parseOptionalFloat(filtersQuery.minMarginPercent),
        excludeHighRisk: parseOptionalBoolean(filtersQuery.excludeHighRisk),
      };

      const summary = await this.arbitrageService.getArbitrageSummary(filters);

      // Generate recommendations based on data
      const recommendations: string[] = [];

      if (summary.totalOpportunities === 0) {
        recommendations.push(
          'No arbitrage opportunities found. Try adjusting your filters or check if market data is up to date.',
        );
      } else {
        if (summary.averageMargin > 20) {
          recommendations.push(
            'Excellent profit margins detected! Consider executing trades quickly as these opportunities may not last.',
          );
        }

        if (summary.topOpportunities.length > 0) {
          const topProfit = summary.topOpportunities[0];
          recommendations.push(
            `Top opportunity: ${topProfit.itemTypeName} - ${topProfit.possibleProfit.toFixed(0)} ISK profit`,
          );
        }

        const highVolumeHubs = summary.byHub.filter(
          (hub) => hub.opportunities > 3,
        );
        if (highVolumeHubs.length > 0) {
          recommendations.push(
            `${highVolumeHubs[0].hubName} has the most opportunities (${highVolumeHubs[0].opportunities})`,
          );
        }
      }

      // Create profit ranges for analysis
      const profitRanges = [
        { range: '< 1M ISK', min: 0, max: 1000000 },
        { range: '1M - 10M ISK', min: 1000000, max: 10000000 },
        { range: '10M - 100M ISK', min: 10000000, max: 100000000 },
        { range: '> 100M ISK', min: 100000000, max: Infinity },
      ];

      const byProfitability = profitRanges.map((range) => {
        const opportunities = summary.topOpportunities.filter(
          (opp) =>
            opp.possibleProfit >= range.min && opp.possibleProfit < range.max,
        );

        const avgMargin =
          opportunities.length > 0
            ? opportunities.reduce((sum, opp) => sum + opp.margin, 0) /
              opportunities.length
            : 0;

        return {
          range: range.range,
          opportunities: opportunities.length,
          avgMargin: Math.round(avgMargin * 100) / 100,
        };
      });

      return {
        success: true,
        data: {
          overview: {
            totalOpportunities: summary.totalOpportunities,
            totalPotentialProfit: summary.totalPotentialProfit.toString(),
            averageMargin: Math.round(summary.averageMargin * 100) / 100,
            topProfitPerM3:
              summary.topOpportunities.length > 0
                ? summary.topOpportunities[0].iskPerM3.toString()
                : '0',
            lastUpdated: new Date().toISOString(),
          },

          byHub: summary.byHub.map((hub) => ({
            hubName: hub.hubName,
            stationId: '', // Would need to be added to summary interface
            opportunities: hub.opportunities,
            totalProfit: hub.totalProfit.toString(),
            avgMargin:
              Math.round((hub.totalProfit / hub.opportunities) * 100) / 100,
          })),

          byProfitability,
          recommendations,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to generate arbitrage summary:', errorMessage);

      return {
        success: false,
        error: 'Failed to generate arbitrage summary',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
