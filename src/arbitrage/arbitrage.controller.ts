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
          : 'profit',
        sortOrder: isValidSortOrder(filtersQuery.sortOrder)
          ? filtersQuery.sortOrder
          : 'desc',
      };

      const opportunities =
        await this.arbitrageService.findArbitrageOpportunities(filters);

      const totalPotentialProfit = opportunities.reduce(
        (sum, opp) => sum + opp.profitAnalysis.netProfit,
        0,
      );

      const averageMargin =
        opportunities.length > 0
          ? opportunities.reduce(
              (sum, opp) => sum + opp.profitAnalysis.grossMarginPercent,
              0,
            ) / opportunities.length
          : 0;

      // Convert to DTOs
      const opportunityDtos = opportunities.map((opp) => ({
        itemTypeId: opp.itemTypeId,
        itemTypeName: opp.itemTypeName,
        volume: opp.volume,

        buyHub: {
          stationId: opp.buyHub.stationId,
          stationName: opp.buyHub.stationName,
          regionName: opp.buyHub.regionName,
          bestBuyPrice: opp.buyHub.bestBuyPrice.toString(),
          availableVolume: opp.buyHub.availableVolume,
          totalValue: opp.buyHub.totalValue.toString(),
        },

        sellHub: {
          stationId: opp.sellHub.stationId,
          stationName: opp.sellHub.stationName,
          regionName: opp.sellHub.regionName,
          bestSellPrice: opp.sellHub.bestSellPrice.toString(),
          demandVolume: opp.sellHub.demandVolume,
          totalValue: opp.sellHub.totalValue.toString(),
        },

        profitAnalysis: {
          grossMargin: opp.profitAnalysis.grossMargin.toString(),
          grossMarginPercent: opp.profitAnalysis.grossMarginPercent,
          netProfit: opp.profitAnalysis.netProfit.toString(),
          netProfitPercent: opp.profitAnalysis.netProfitPercent,
          profitPerM3: opp.profitAnalysis.profitPerM3.toString(),
          roi: opp.profitAnalysis.roi,
        },

        costs: {
          buyPrice: opp.costs.buyPrice.toString(),
          sellPrice: opp.costs.sellPrice.toString(),
          salesTax: opp.costs.salesTax.toString(),
          brokerFee: opp.costs.brokerFee.toString(),
          totalCost: opp.costs.totalCost.toString(),
          totalRevenue: opp.costs.totalRevenue.toString(),
        },

        logistics: {
          recommendedQuantity: opp.logistics.recommendedQuantity,
          totalCargo: opp.logistics.totalCargo,
          shipmentsNeeded: opp.logistics.shipmentsNeeded,
          cargoEfficiency: opp.logistics.cargoEfficiency,
        },

        metadata: {
          calculatedAt: opp.metadata.calculatedAt.toISOString(),
          buyOrderAge: opp.metadata.buyOrderAge,
          sellOrderAge: opp.metadata.sellOrderAge,
          spreadPercent: opp.metadata.spreadPercent,
          confidence: opp.metadata.confidence,
        },
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
          buyStationId: opportunity.buyHub.stationId,
          sellStationId: opportunity.sellHub.stationId,
          quantity,

          calculation: {
            buyPrice: opportunity.costs.buyPrice.toString(),
            sellPrice: opportunity.costs.sellPrice.toString(),
            grossProfit: opportunity.profitAnalysis.grossMargin.toString(),
            netProfit: opportunity.profitAnalysis.netProfit.toString(),
            profitMargin: opportunity.profitAnalysis.grossMarginPercent,
            roi: opportunity.profitAnalysis.roi,
            profitPerM3: opportunity.profitAnalysis.profitPerM3.toString(),
          },

          costs: {
            itemCost: (opportunity.costs.buyPrice * quantity).toString(),
            salesTax: opportunity.costs.salesTax.toString(),
            brokerFees: opportunity.costs.brokerFee.toString(),
            totalCost: opportunity.costs.totalCost.toString(),
          },

          logistics: {
            totalVolume: opportunity.logistics.totalCargo,
            shipmentsNeeded: opportunity.logistics.shipmentsNeeded,
            cargoEfficiency: opportunity.logistics.cargoEfficiency,
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
            `Top opportunity: ${topProfit.itemTypeName} - ${topProfit.profitAnalysis.netProfit.toFixed(0)} ISK profit`,
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
            opp.profitAnalysis.netProfit >= range.min &&
            opp.profitAnalysis.netProfit < range.max,
        );

        const avgMargin =
          opportunities.length > 0
            ? opportunities.reduce(
                (sum, opp) => sum + opp.profitAnalysis.grossMarginPercent,
                0,
              ) / opportunities.length
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
                ? summary.topOpportunities[0].profitAnalysis.profitPerM3.toString()
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
