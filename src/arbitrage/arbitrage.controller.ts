import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';
import {
  ArbitrageOpportunitiesDto,
  ArbitrageCalculationDto,
  ArbitrageFiltersDto,
  ArbitrageSummaryDto,
  ArbitrageErrorDto,
} from './dto/arbitrage.dto';
import {
  ArbitrageQueryParams,
  ArbitrageSummaryQueryParams,
  ArbitrageCalculationBody,
  parseOptionalFloat,
  parseOptionalInt,
  parseOptionalBoolean,
  isValidSortBy,
  isValidSortOrder,
} from './interfaces/query.interface';

@Controller('arbitrage')
export class ArbitrageController {
  private readonly logger = new Logger(ArbitrageController.name);

  constructor(private readonly arbitrageService: ArbitrageService) {}

  @Get('opportunities')
  async getArbitrageOpportunities(
    @Query() filtersQuery: ArbitrageQueryParams,
  ): Promise<ArbitrageOpportunitiesDto | ArbitrageErrorDto> {
    try {
      this.logger.log('Fetching arbitrage opportunities...');

      // Parse query parameters into filters
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
          : 'margin', // Changed default to margin
        sortOrder: isValidSortOrder(filtersQuery.sortOrder)
          ? filtersQuery.sortOrder
          : 'desc',
        // Add hub filtering
        fromHub: filtersQuery.fromHub,
        toHub: filtersQuery.toHub,
      };

      const opportunities =
        await this.arbitrageService.findArbitrageOpportunities(filters);

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
      const opportunityDtos = opportunities.map((opp) => ({
        // Core item info
        itemTypeName: opp.itemTypeName,

        // Hub routing (solar system names)
        fromHub: opp.fromHub,
        toHub: opp.toHub,

        // Key metrics for trading decisions
        margin: Math.round(opp.margin * 100) / 100, // Round to 2 decimal places
        possibleProfit: Math.round(opp.possibleProfit),
        tradesPerWeek: opp.tradesPerWeek,
        totalAmountTradedPerWeek: opp.totalAmountTradedPerWeek,
        iskPerM3: Math.round(opp.iskPerM3),

        // DEBUG: Source and destination prices for verification
        buyPrice: opp.details?.costs.buyPrice ?? 0,
        sellPrice: opp.details?.costs.sellPrice ?? 0,
      }));

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

      // Hub name to station ID mapping
      const hubToStationId: Record<string, bigint> = {
        jita: BigInt(60003760), // Jita IV - Moon 4 - Caldari Navy Assembly Plant
        amarr: BigInt(60008494), // Amarr VIII (Oris) - Emperor Family Academy
        dodixie: BigInt(60011866), // Dodixie IX - Moon 20 - Federation Navy Assembly Plant
        rens: BigInt(60004588), // Rens VI - Moon 8 - Brutor Tribe Treasury
        hek: BigInt(60005686), // Hek VIII - Moon 12 - Boundless Creation Factory
      };

      const sourceStationId = hubToStationId[sourceHub?.toLowerCase()];
      const destStationId = hubToStationId[destHub?.toLowerCase()];

      if (!sourceStationId || !destStationId) {
        return {
          success: false,
          error: 'Invalid hub names. Use: jita, amarr, dodixie, rens, hek',
          timestamp: new Date().toISOString(),
        };
      }

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
        tradesPerWeek: opp.tradesPerWeek,
        totalAmountTradedPerWeek: opp.totalAmountTradedPerWeek,
        iskPerM3: Math.round(opp.iskPerM3),
        buyPrice: opp.details?.costs.buyPrice ?? 0,
        sellPrice: opp.details?.costs.sellPrice ?? 0,
      }));

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

  @Post('calculate')
  async calculateArbitrage(
    @Body() body: ArbitrageCalculationBody,
  ): Promise<ArbitrageCalculationDto | ArbitrageErrorDto> {
    try {
      const { itemTypeId, buyStationId, sellStationId, quantity } = body;

      this.logger.log(
        `Calculating arbitrage for item ${itemTypeId} from ${buyStationId} to ${sellStationId}, quantity: ${quantity}`,
      );

      const opportunity =
        await this.arbitrageService.calculateSpecificArbitrage(
          itemTypeId,
          buyStationId,
          sellStationId,
          quantity,
        );

      if (!opportunity) {
        return {
          success: false,
          error: 'No arbitrage opportunity found for the specified parameters',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: {
          itemTypeId: opportunity.itemTypeId,
          itemTypeName: opportunity.itemTypeName,
          buyStationId: opportunity.details?.buyHub.stationId ?? '',
          sellStationId: opportunity.details?.sellHub.stationId ?? '',
          quantity,

          calculation: {
            buyPrice: opportunity.details?.costs.buyPrice.toString() ?? '0',
            sellPrice: opportunity.details?.costs.sellPrice.toString() ?? '0',
            grossProfit:
              opportunity.details?.profitAnalysis.grossMargin.toString() ?? '0',
            netProfit: opportunity.possibleProfit.toString(), // Use streamlined field
            profitMargin: opportunity.margin, // Use streamlined field
            roi: opportunity.details?.profitAnalysis.roi ?? 0,
            profitPerM3: opportunity.iskPerM3.toString(), // Use streamlined field
          },

          costs: {
            itemCost: (
              (opportunity.details?.costs.buyPrice ?? 0) * quantity
            ).toString(),
            salesTax: opportunity.details?.costs.salesTax.toString() ?? '0',
            brokerFees: opportunity.details?.costs.brokerFee.toString() ?? '0',
            totalCost: opportunity.details?.costs.totalCost.toString() ?? '0',
          },

          logistics: {
            totalVolume: opportunity.details?.logistics.totalCargo ?? 0,
            shipmentsNeeded:
              opportunity.details?.logistics.shipmentsNeeded ?? 0,
            cargoEfficiency:
              opportunity.details?.logistics.cargoEfficiency ?? 0,
          },
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to calculate arbitrage:', errorMessage);

      return {
        success: false,
        error: 'Failed to calculate arbitrage',
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

  @Post('refresh-prices')
  refreshMarketPrices(): {
    success: boolean;
    message: string;
    data?: any;
  } {
    try {
      this.logger.log(
        'Manually refreshing market prices for arbitrage analysis...',
      );

      // This would trigger a fresh fetch from ESI
      // The actual price fetching is handled by the ESI service
      // which is used automatically by the arbitrage service

      return {
        success: true,
        message: 'Market prices will be refreshed on next arbitrage analysis',
        data: {
          refreshedAt: new Date().toISOString(),
          note: 'Prices are fetched fresh from ESI for each arbitrage calculation',
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to refresh market prices:', errorMessage);

      return {
        success: false,
        message: 'Failed to refresh market prices',
      };
    }
  }
}
