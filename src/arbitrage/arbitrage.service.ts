import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EsiService } from '../esi/esi.service';
import { LiquidityAnalyzerService } from '../market-data/liquidity-analyzer.service';
import {
  ArbitrageOpportunity,
  TaxCalculation,
  LogisticsCalculation,
  ArbitrageFilters,
  ArbitrageSummary,
} from './interfaces/arbitrage.interface';
import {
  MarketPrice,
  StationInfo,
  ItemTypeInfo,
  convertEsiToMarketPrice,
} from './interfaces/market-data.interface';

@Injectable()
export class ArbitrageService {
  private readonly logger = new Logger(ArbitrageService.name);

  // Default EVE Online tax rates (can be improved with skills)
  private readonly defaultTaxRates = {
    salesTax: 0.0225, // 2.25% - reducible with Accounting skill
    brokerFee: 0.0225, // 2.25% - reducible with Broker Relations skill
  };

  // Default freighter cargo capacity
  private readonly defaultCargoCapacity = 60000; // m³

  constructor(
    private readonly prisma: PrismaService,
    private readonly esiService: EsiService,
    private readonly liquidityAnalyzer: LiquidityAnalyzerService,
  ) {}

  /**
   * Find all current arbitrage opportunities
   */
  async findArbitrageOpportunities(
    filters?: ArbitrageFilters,
  ): Promise<ArbitrageOpportunity[]> {
    this.logger.log('Starting arbitrage opportunity analysis...');

    // SIMPLIFIED: Only filter items that have sold recently (fast turnover)
    const simpleFilters = {
      maxDaysStale: 7, // Must have sold within last 7 days (fast turnover)
      // NO minHubCount - irrelevant for arbitrage
      // NO minTotalTrades - use recent frequency instead
      // NO minValue - redundant with ISK/m³ sorting
      // NO minLiquidityScore - use for sorting, not filtering
    };

    const liquidItemIds = await this.liquidityAnalyzer.getRecentlyTradedItems(
      simpleFilters.maxDaysStale,
    );

    this.logger.log(
      `Using simplified filtering: found ${liquidItemIds.length} items traded within ${simpleFilters.maxDaysStale} days`,
    );

    // Get fresh market prices from ESI
    const rawMarketPrices =
      await this.esiService.fetchMarketPricesForTrackedStations();

    // Convert ESI data to our internal format and filter to recently traded items
    const allMarketPrices: MarketPrice[] = rawMarketPrices.map(
      convertEsiToMarketPrice,
    );

    const marketPrices =
      liquidItemIds.length > 0
        ? allMarketPrices.filter((price) =>
            liquidItemIds.includes(price.itemTypeId),
          )
        : allMarketPrices; // Fallback to all items if no recent items found

    if (marketPrices.length === 0) {
      this.logger.warn('No valid market prices available for analysis');
      return [];
    }

    this.logger.log(
      `Filtering ${allMarketPrices.length} → ${marketPrices.length} market prices (only recently traded items)`,
    );

    // Group prices by item type for comparison
    const pricesByItem = this.groupPricesByItem(marketPrices);

    this.logger.debug(
      `Grouped market prices into ${pricesByItem.size} unique items`,
    );

    const opportunities: ArbitrageOpportunity[] = [];

    for (const [itemTypeId, prices] of pricesByItem) {
      this.logger.debug(
        `Analyzing item ${itemTypeId}: ${prices.length} price points across hubs`,
      );

      // Find the best buy and sell opportunities for this item
      const itemOpportunities = await this.analyzeItemArbitrage(
        parseInt(itemTypeId),
        prices,
        filters,
      );

      this.logger.debug(
        `Item ${itemTypeId} produced ${itemOpportunities.length} opportunities`,
      );
      opportunities.push(...itemOpportunities);
    }

    // Filter and sort opportunities
    this.logger.debug(
      `Generated ${opportunities.length} raw opportunities before filtering`,
    );

    const filteredOpportunities = this.applyFilters(opportunities, filters);
    this.logger.debug(
      `${opportunities.length} → ${filteredOpportunities.length} opportunities after filtering`,
    );

    const sortedOpportunities = this.sortOpportunities(
      filteredOpportunities,
      filters,
    );

    this.logger.log(
      `Found ${sortedOpportunities.length} arbitrage opportunities`,
    );

    return sortedOpportunities;
  }

  /**
   * Calculate arbitrage for a specific item between two stations
   */
  async calculateSpecificArbitrage(
    itemTypeId: number,
    buyStationId: string,
    sellStationId: string,
    quantity: number,
  ): Promise<ArbitrageOpportunity | null> {
    this.logger.log(
      `Calculating arbitrage for item ${itemTypeId} from ${buyStationId} to ${sellStationId}`,
    );

    // Get fresh market prices
    const rawMarketPrices =
      await this.esiService.fetchMarketPricesForTrackedStations();
    const marketPrices: MarketPrice[] = rawMarketPrices.map(
      convertEsiToMarketPrice,
    );

    const itemPrices = marketPrices.filter((p) => p.itemTypeId === itemTypeId);

    const buyOrders = itemPrices.filter(
      (p) => p.orderType === 'sell' && p.locationId.toString() === buyStationId,
    );

    const sellOrders = itemPrices.filter(
      (p) => p.orderType === 'buy' && p.locationId.toString() === sellStationId,
    );

    if (buyOrders.length === 0 || sellOrders.length === 0) {
      this.logger.warn(`No matching orders found for item ${itemTypeId}`);
      return null;
    }

    // Get the best prices
    const bestBuyOrder = buyOrders.reduce((min, order) =>
      order.price < min.price ? order : min,
    );

    const bestSellOrder = sellOrders.reduce((max, order) =>
      order.price > max.price ? order : max,
    );

    // Get item info including volume
    const itemType = await this.prisma.itemType.findUnique({
      where: { id: itemTypeId },
      select: { id: true, name: true, volume: true },
    });

    if (!itemType || !itemType.volume) {
      this.logger.warn(`Item ${itemTypeId} not found or missing volume data`);
      return null;
    }

    // Calculate the arbitrage opportunity
    return this.calculateArbitrageOpportunity(
      bestBuyOrder,
      bestSellOrder,
      itemType,
      quantity,
    );
  }

  /**
   * Get arbitrage summary statistics
   */
  async getArbitrageSummary(
    filters?: ArbitrageFilters,
  ): Promise<ArbitrageSummary> {
    const opportunities = await this.findArbitrageOpportunities(filters);

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

    // Group by hub
    const hubStats = new Map<
      string,
      { opportunities: number; totalProfit: number }
    >();

    opportunities.forEach((opp) => {
      const hubName = opp.sellHub.stationName;
      const existing = hubStats.get(hubName) || {
        opportunities: 0,
        totalProfit: 0,
      };
      existing.opportunities++;
      existing.totalProfit += opp.profitAnalysis.netProfit;
      hubStats.set(hubName, existing);
    });

    return {
      totalOpportunities: opportunities.length,
      totalPotentialProfit,
      averageMargin,
      topOpportunities: opportunities.slice(0, 10), // Top 10
      byHub: Array.from(hubStats.entries()).map(([hubName, stats]) => ({
        hubName,
        opportunities: stats.opportunities,
        totalProfit: stats.totalProfit,
      })),
      byCategory: [], // TODO: Implement category grouping
    };
  }

  /**
   * Group market prices by item type
   */
  private groupPricesByItem(prices: MarketPrice[]): Map<string, MarketPrice[]> {
    const grouped = new Map<string, MarketPrice[]>();

    prices.forEach((price) => {
      const itemId = price.itemTypeId.toString();
      if (!grouped.has(itemId)) {
        grouped.set(itemId, []);
      }
      grouped.get(itemId)!.push(price);
    });

    return grouped;
  }

  /**
   * Analyze cross-region arbitrage opportunities for a specific item
   * EVE Trading Reality: Buy from low-price region, transport and sell in high-price region
   */
  private async analyzeItemArbitrage(
    itemTypeId: number,
    prices: MarketPrice[],
    filters?: ArbitrageFilters,
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    // Get item info
    const itemType = await this.prisma.itemType.findUnique({
      where: { id: itemTypeId },
      select: { id: true, name: true, volume: true },
    });

    if (!itemType || !itemType.volume) {
      this.logger.debug(`Skipping item ${itemTypeId}: No item info or volume`);
      return opportunities;
    }

    // Only analyze sell orders for cross-region arbitrage
    const sellOrders = prices.filter((p) => p.orderType === 'sell');

    this.logger.debug(
      `Item ${itemTypeId} (${itemType.name}): ${sellOrders.length} sell orders across regions`,
    );

    // Find cross-region arbitrage opportunities between all region combinations
    let comparisons = 0;
    let sameRegion = 0;
    let unprofitable = 0;

    for (const sourceSellOrder of sellOrders) {
      for (const destinationSellOrder of sellOrders) {
        comparisons++;

        // Don't trade within the same region
        if (sourceSellOrder.regionId === destinationSellOrder.regionId) {
          sameRegion++;
          continue;
        }

        // Only consider profitable opportunities (destination sell price > source sell price)
        if (destinationSellOrder.price <= sourceSellOrder.price) {
          unprofitable++;
          continue;
        }

        const opportunity = await this.calculateCrossRegionArbitrageOpportunity(
          sourceSellOrder,
          destinationSellOrder,
          itemType,
          Math.min(sourceSellOrder.volume, destinationSellOrder.volume),
        );

        if (opportunity && this.meetsFilterCriteria(opportunity, filters)) {
          opportunities.push(opportunity);
        }
      }
    }

    this.logger.debug(
      `Item ${itemTypeId} analysis: ${comparisons} comparisons, ${sameRegion} same region, ${unprofitable} unprofitable, ${opportunities.length} opportunities found`,
    );

    return opportunities;
  }

  /**
   * Calculate cross-region arbitrage opportunity between sell orders in different regions
   * EVE Reality: Buy from source region, transport to destination region, place sell order
   */
  private async calculateCrossRegionArbitrageOpportunity(
    sourceSellOrder: MarketPrice,
    destinationSellOrder: MarketPrice,
    itemType: ItemTypeInfo,
    quantity: number,
  ): Promise<ArbitrageOpportunity | null> {
    try {
      // Get station information
      const [sourceStation, destinationStation] = await Promise.all([
        this.getStationInfo(sourceSellOrder.locationId),
        this.getStationInfo(destinationSellOrder.locationId),
      ]);

      if (!sourceStation || !destinationStation) {
        return null;
      }

      // Calculate taxes and logistics
      const taxCalc = this.calculateTaxes();
      const logistics = this.calculateLogistics(itemType.volume ?? 1, quantity);

      const sourceBuyPrice = sourceSellOrder.price; // Price to buy from source region
      const destinationSellPrice = destinationSellOrder.price; // Competitive sell price in destination
      const totalCost = sourceBuyPrice * quantity;
      const grossRevenue = destinationSellPrice * quantity;

      // Calculate fees (buy broker fee in source + sell broker fee + sales tax in destination)
      const buyBrokerFee = totalCost * taxCalc.brokerFee; // Fee to buy in source
      const sellBrokerFee = grossRevenue * taxCalc.brokerFee; // Fee to list in destination
      const salesTax = grossRevenue * taxCalc.salesTax; // Tax when item sells in destination
      const totalFees = buyBrokerFee + sellBrokerFee + salesTax;

      const grossMargin = destinationSellPrice - sourceBuyPrice;
      const netProfit = grossRevenue - totalCost - totalFees;
      const profitPerM3 = netProfit / logistics.totalVolume;

      // Confidence scoring based on order age and volume
      const sourceOrderAge = this.calculateOrderAge(sourceSellOrder.issued);
      const destinationOrderAge = this.calculateOrderAge(
        destinationSellOrder.issued,
      );
      const confidence = this.calculateConfidence(
        sourceOrderAge,
        destinationOrderAge,
        quantity,
        sourceSellOrder.volume,
        destinationSellOrder.volume,
      );

      return {
        itemTypeId: itemType.id,
        itemTypeName: itemType.name,
        volume: itemType.volume ?? 0,

        buyHub: {
          stationId: sourceSellOrder.locationId.toString(),
          stationName: sourceStation.name,
          regionId: sourceStation.regionId,
          regionName: sourceStation.regionName,
          bestBuyPrice: sourceBuyPrice,
          availableVolume: sourceSellOrder.volume,
          totalValue: totalCost,
        },

        sellHub: {
          stationId: destinationSellOrder.locationId.toString(),
          stationName: destinationStation.name,
          regionId: destinationStation.regionId,
          regionName: destinationStation.regionName,
          bestSellPrice: destinationSellPrice,
          demandVolume: destinationSellOrder.volume, // Competitive volume at this price
          totalValue: grossRevenue,
        },

        profitAnalysis: {
          grossMargin,
          grossMarginPercent: (grossMargin / sourceBuyPrice) * 100,
          netProfit,
          netProfitPercent: (netProfit / totalCost) * 100,
          profitPerM3,
          roi: (netProfit / totalCost) * 100,
        },

        costs: {
          buyPrice: sourceBuyPrice,
          sellPrice: destinationSellPrice,
          salesTax,
          brokerFee: buyBrokerFee + sellBrokerFee,
          totalCost: totalCost + buyBrokerFee,
          totalRevenue: grossRevenue - sellBrokerFee - salesTax,
        },

        logistics,

        metadata: {
          calculatedAt: new Date(),
          buyOrderAge: sourceOrderAge,
          sellOrderAge: destinationOrderAge,
          spreadPercent:
            ((destinationSellPrice - sourceBuyPrice) / sourceBuyPrice) * 100,
          confidence,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to calculate cross-region arbitrage opportunity: ${errorMessage}`,
      );
      return null;
    }
  }

  /**
   * Calculate detailed arbitrage opportunity
   * LEGACY METHOD - kept for backwards compatibility but not used in cross-region logic
   */
  private async calculateArbitrageOpportunity(
    buyOrder: MarketPrice, // Where we buy (sell order)
    sellOrder: MarketPrice, // Where we sell (buy order)
    itemType: ItemTypeInfo,
    quantity: number,
  ): Promise<ArbitrageOpportunity | null> {
    try {
      // Get station information
      const [buyStation, sellStation] = await Promise.all([
        this.getStationInfo(buyOrder.locationId),
        this.getStationInfo(sellOrder.locationId),
      ]);

      if (!buyStation || !sellStation) {
        return null;
      }

      // Calculate taxes and fees
      const taxCalc = this.calculateTaxes();
      const logistics = this.calculateLogistics(itemType.volume ?? 1, quantity);

      const buyPrice = buyOrder.price;
      const sellPrice = sellOrder.price;
      const totalCost = buyPrice * quantity;
      const grossRevenue = sellPrice * quantity;

      // Calculate fees
      const salesTax = grossRevenue * taxCalc.salesTax;
      const brokerFee = totalCost * taxCalc.brokerFee;
      const totalFees = salesTax + brokerFee;

      const grossMargin = sellPrice - buyPrice;
      const netProfit = grossRevenue - totalCost - totalFees;
      const profitPerM3 = netProfit / logistics.totalVolume;

      // Confidence scoring based on order age and volume
      const buyOrderAge = this.calculateOrderAge(buyOrder.issued);
      const sellOrderAge = this.calculateOrderAge(sellOrder.issued);
      const confidence = this.calculateConfidence(
        buyOrderAge,
        sellOrderAge,
        quantity,
        buyOrder.volume,
        sellOrder.volume,
      );

      return {
        itemTypeId: itemType.id,
        itemTypeName: itemType.name,
        volume: itemType.volume ?? 0,

        buyHub: {
          stationId: buyOrder.locationId.toString(),
          stationName: buyStation.name,
          regionId: buyStation.regionId,
          regionName: buyStation.regionName,
          bestBuyPrice: buyPrice,
          availableVolume: buyOrder.volume,
          totalValue: totalCost,
        },

        sellHub: {
          stationId: sellOrder.locationId.toString(),
          stationName: sellStation.name,
          regionId: sellStation.regionId,
          regionName: sellStation.regionName,
          bestSellPrice: sellPrice,
          demandVolume: sellOrder.volume,
          totalValue: grossRevenue,
        },

        profitAnalysis: {
          grossMargin,
          grossMarginPercent: (grossMargin / buyPrice) * 100,
          netProfit,
          netProfitPercent: (netProfit / totalCost) * 100,
          profitPerM3,
          roi: (netProfit / totalCost) * 100,
        },

        costs: {
          buyPrice,
          sellPrice,
          salesTax,
          brokerFee,
          totalCost: totalCost + brokerFee,
          totalRevenue: grossRevenue - salesTax,
        },

        logistics,

        metadata: {
          calculatedAt: new Date(),
          buyOrderAge,
          sellOrderAge,
          spreadPercent: ((sellPrice - buyPrice) / buyPrice) * 100,
          confidence,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        'Error calculating arbitrage opportunity:',
        errorMessage,
      );
      return null;
    }
  }

  /**
   * Calculate EVE Online taxes (basic version)
   */
  private calculateTaxes(
    accountingLevel = 0,
    brokerRelationsLevel = 0,
    standings = 0,
  ): TaxCalculation {
    // Accounting skill reduces sales tax by 10% per level
    const salesTaxReduction = accountingLevel * 0.1;
    const salesTax = this.defaultTaxRates.salesTax * (1 - salesTaxReduction);

    // Broker Relations skill reduces broker fees by 10% per level
    // Standings also affect broker fees
    const brokerFeeReduction = brokerRelationsLevel * 0.1;
    const standingsReduction = Math.max(standings, 0) * 0.001; // Small reduction for positive standings
    const brokerFee =
      this.defaultTaxRates.brokerFee *
      (1 - brokerFeeReduction - standingsReduction);

    return {
      salesTax: Math.max(salesTax, 0),
      brokerFee: Math.max(brokerFee, 0),
      totalTaxRate: salesTax + brokerFee,
      accountingLevel,
      brokerRelationsLevel,
      standings,
    };
  }

  /**
   * Calculate logistics requirements
   */
  private calculateLogistics(
    itemVolume: number,
    quantity: number,
    cargoCapacity = this.defaultCargoCapacity,
  ): LogisticsCalculation {
    const totalVolume = itemVolume * quantity;
    const maxUnitsPerTrip = Math.floor(cargoCapacity / itemVolume);
    const shipmentsRequired = Math.ceil(quantity / maxUnitsPerTrip);
    const wastedSpace = shipmentsRequired * cargoCapacity - totalVolume;
    const efficiency =
      (totalVolume / (shipmentsRequired * cargoCapacity)) * 100;

    return {
      cargoCapacity,
      itemVolume,
      maxUnitsPerTrip,
      optimalQuantity: quantity,
      shipmentsRequired,
      wastedSpace,
      efficiency,
      recommendedQuantity: quantity,
      totalCargo: totalVolume,
      totalVolume: totalVolume,
      shipmentsNeeded: shipmentsRequired,
      cargoEfficiency: efficiency,
    };
  }

  /**
   * Get station information with region data
   */
  private async getStationInfo(stationId: bigint): Promise<StationInfo | null> {
    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
      include: {
        solarSystem: {
          include: {
            region: true,
          },
        },
      },
    });

    if (!station) return null;

    return {
      id: station.id,
      name: station.name,
      regionId: station.solarSystem.region.id,
      regionName: station.solarSystem.region.name,
    };
  }

  /**
   * Calculate order age in hours
   */
  private calculateOrderAge(issued: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - issued.getTime();
    return diffMs / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Calculate confidence score for an opportunity
   */
  private calculateConfidence(
    buyOrderAge: number,
    sellOrderAge: number,
    quantity: number,
    buyVolume: number,
    sellVolume: number,
  ): 'high' | 'medium' | 'low' {
    // High confidence: Recent orders, good volume
    if (
      buyOrderAge < 2 &&
      sellOrderAge < 2 &&
      quantity <= Math.min(buyVolume, sellVolume) * 0.5
    ) {
      return 'high';
    }

    // Low confidence: Old orders, low volume
    if (
      buyOrderAge > 12 ||
      sellOrderAge > 12 ||
      quantity > Math.min(buyVolume, sellVolume) * 0.8
    ) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Check if opportunity meets filter criteria
   */
  private meetsFilterCriteria(
    opportunity: ArbitrageOpportunity,
    filters?: ArbitrageFilters,
  ): boolean {
    if (!filters) return true;

    if (
      filters.minProfit &&
      opportunity.profitAnalysis.netProfit < filters.minProfit
    ) {
      return false;
    }

    if (
      filters.minMarginPercent &&
      opportunity.profitAnalysis.grossMarginPercent < filters.minMarginPercent
    ) {
      return false;
    }

    if (
      filters.maxCargoVolume &&
      opportunity.logistics.totalCargo > filters.maxCargoVolume
    ) {
      return false;
    }

    if (
      filters.maxInvestment &&
      opportunity.costs.totalCost > filters.maxInvestment
    ) {
      return false;
    }

    if (
      filters.minProfitPerM3 &&
      opportunity.profitAnalysis.profitPerM3 < filters.minProfitPerM3
    ) {
      return false;
    }

    if (filters.excludeHighRisk && opportunity.metadata.confidence === 'low') {
      return false;
    }

    return true;
  }

  /**
   * Apply filters to opportunities list
   */
  private applyFilters(
    opportunities: ArbitrageOpportunity[],
    filters?: ArbitrageFilters,
  ): ArbitrageOpportunity[] {
    return opportunities.filter((opp) =>
      this.meetsFilterCriteria(opp, filters),
    );
  }

  /**
   * Sort opportunities by specified criteria
   */
  private sortOpportunities(
    opportunities: ArbitrageOpportunity[],
    filters?: ArbitrageFilters,
  ): ArbitrageOpportunity[] {
    const sortBy = filters?.sortBy || 'profit';
    const sortOrder = filters?.sortOrder || 'desc';

    opportunities.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'margin':
          aValue = a.profitAnalysis.grossMarginPercent;
          bValue = b.profitAnalysis.grossMarginPercent;
          break;
        case 'profitPerM3':
          aValue = a.profitAnalysis.profitPerM3;
          bValue = b.profitAnalysis.profitPerM3;
          break;
        case 'roi':
          aValue = a.profitAnalysis.roi;
          bValue = b.profitAnalysis.roi;
          break;
        default: // 'profit'
          aValue = a.profitAnalysis.netProfit;
          bValue = b.profitAnalysis.netProfit;
          break;
      }

      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

    // Apply limit if specified
    if (filters?.limit) {
      return opportunities.slice(0, filters.limit);
    }

    return opportunities;
  }
}
