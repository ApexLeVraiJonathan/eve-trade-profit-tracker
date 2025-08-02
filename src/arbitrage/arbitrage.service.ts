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

    // Get fresh market prices from ESI for all tracked items
    // Let the opportunity analysis and filtering handle liquidity/profitability
    const rawMarketPrices =
      await this.esiService.fetchMarketPricesForTrackedStations();

    // Convert ESI data to our internal format
    const marketPrices: MarketPrice[] = rawMarketPrices.map(
      convertEsiToMarketPrice,
    );

    if (marketPrices.length === 0) {
      this.logger.warn('No valid market prices available for analysis');
      return [];
    }

    this.logger.log(
      `Processing ${marketPrices.length} market prices for arbitrage analysis`,
    );

    // Group prices by item type for comparison
    const pricesByItem = this.groupPricesByItem(marketPrices);

    this.logger.debug(
      `Grouped market prices into ${pricesByItem.size} unique items`,
    );

    const opportunities: ArbitrageOpportunity[] = [];

    // Pre-fetch all item type data to avoid N+1 database queries
    const uniqueItemTypeIds = Array.from(pricesByItem.keys()).map((id) =>
      parseInt(id),
    );
    const itemTypes = await this.prisma.itemType.findMany({
      where: { id: { in: uniqueItemTypeIds } },
      select: { id: true, name: true, volume: true },
    });
    const itemTypeMap = new Map(itemTypes.map((item) => [item.id, item]));

    for (const [itemTypeId, prices] of pricesByItem) {
      // Removed general debug logging

      // Find the best buy and sell opportunities for this item
      const itemOpportunities = await this.analyzeItemArbitrage(
        parseInt(itemTypeId),
        prices,
        filters,
        itemTypeMap,
      );

      // Removed general debug logging
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
      (sum, opp) => sum + opp.possibleProfit,
      0,
    );

    const averageMargin =
      opportunities.length > 0
        ? opportunities.reduce((sum, opp) => sum + opp.margin, 0) /
          opportunities.length
        : 0;

    // Group by hub
    const hubStats = new Map<
      string,
      { opportunities: number; totalProfit: number }
    >();

    opportunities.forEach((opp) => {
      const hubName = opp.toHub; // Use streamlined hub name
      const existing = hubStats.get(hubName) || {
        opportunities: 0,
        totalProfit: 0,
      };
      existing.opportunities++;
      existing.totalProfit += opp.possibleProfit; // Use streamlined field
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
    itemTypeMap?: Map<
      number,
      { id: number; name: string; volume: number | null }
    >,
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    this.logger.log(
      `🔍 ENTER analyzeItemArbitrage: itemTypeId=${itemTypeId}, ${prices.length} prices`,
    );

    // Get item info from map or database
    let itemType:
      | { id: number; name: string; volume: number | null }
      | undefined;
    if (itemTypeMap) {
      itemType = itemTypeMap.get(itemTypeId);
    } else {
      // Fallback to database query if map not provided
      const dbItemType = await this.prisma.itemType.findUnique({
        where: { id: itemTypeId },
        select: { id: true, name: true, volume: true },
      });
      itemType = dbItemType || undefined;
    }

    if (!itemType) {
      this.logger.log(
        `❌ EARLY EXIT: Item type ${itemTypeId} not found in database/map`,
      );
      return opportunities;
    }

    if (!itemType.volume) {
      this.logger.log(
        `❌ EARLY EXIT: Item ${itemType.name} has no volume (${itemType.volume})`,
      );
      return opportunities;
    }

    this.logger.log(
      `✅ CHECKPOINT 1: Item ${itemType.name}, volume: ${itemType.volume}m³`,
    );

    // Only analyze sell orders for cross-region arbitrage
    const sellOrders = prices.filter((p) => p.orderType === 'sell');

    if (sellOrders.length === 0) {
      this.logger.log(
        `❌ EARLY EXIT: Item ${itemType.name} has no sell orders (${prices.length} total prices)`,
      );
      return opportunities;
    }

    this.logger.log(
      `✅ CHECKPOINT 2: Item ${itemType.name}, ${sellOrders.length} sell orders`,
    );

    // DEBUG: Log Photonic items analysis
    if (itemType.name.toLowerCase().includes('photonic')) {
      this.logger.log(`🔍 PHOTONIC ANALYSIS: ${itemType.name}`);
      this.logger.log(`  Sell orders: ${sellOrders.length}`);
      if (sellOrders.length > 0) {
        this.logger.log(
          `  Price range: ${Math.min(...sellOrders.map((o) => o.price))} - ${Math.max(...sellOrders.map((o) => o.price))} ISK`,
        );
      }
    }

    // GROUP BY REGION and find BEST PRICES in each region
    const sellOrdersByRegion = new Map<number, MarketPrice[]>();
    sellOrders.forEach((order) => {
      if (!sellOrdersByRegion.has(order.regionId)) {
        sellOrdersByRegion.set(order.regionId, []);
      }
      sellOrdersByRegion.get(order.regionId)!.push(order);
    });

    // Sort orders in each region by price (cheapest first)
    sellOrdersByRegion.forEach((orders, regionId) => {
      orders.sort((a, b) => a.price - b.price);
      // DEBUG: Log price selection for Photonic items
      if (itemType.name.includes('Photonic')) {
        this.logger.log(
          `  Region ${regionId}: [${orders
            .slice(0, 2)
            .map((o) => o.price)
            .join(', ')}] ISK`,
        );
      }
    });

    // Removed general debug logging

    // Find cross-region arbitrage opportunities using BEST PRICES
    let comparisons = 0;
    let unprofitable = 0;
    let profitable = 0;

    // DEBUG: Log detailed analysis for ALL items to find the issue
    this.logger.log(
      `🔍 ANALYZING: ${itemType.name} - Regions: ${Array.from(sellOrdersByRegion.keys()).join(', ')}`,
    );
    for (const [regionId, orders] of sellOrdersByRegion) {
      this.logger.log(
        `🔍   Region ${regionId}: ${orders.length} orders, cheapest: ${orders[0]?.price} ISK`,
      );
    }

    for (const [sourceRegionId, sourceOrders] of sellOrdersByRegion) {
      if (sourceOrders.length === 0) continue;

      // Get the CHEAPEST sell order in source region (best price to buy)
      const bestSourceOrder = sourceOrders[0];

      for (const [destRegionId, destOrders] of sellOrdersByRegion) {
        if (destOrders.length === 0 || sourceRegionId === destRegionId)
          continue;

        // Get competitive sell price in destination (2nd cheapest to undercut the market)
        const competitiveDestOrder =
          destOrders.length > 1 ? destOrders[1] : destOrders[0];

        // DEBUG: Log every arbitrage calculation to find the issue
        this.logger.log(
          `🔍 COMPARING: ${itemType.name} - Region ${sourceRegionId}→${destRegionId}: ${bestSourceOrder.price} → ${competitiveDestOrder.price} ISK`,
        );

        comparisons++;

        // Only consider profitable opportunities
        if (competitiveDestOrder.price <= bestSourceOrder.price) {
          unprofitable++;
          this.logger.log(
            `❌ UNPROFITABLE: ${itemType.name} - ${bestSourceOrder.price} → ${competitiveDestOrder.price} (lose ${bestSourceOrder.price - competitiveDestOrder.price} ISK)`,
          );
          continue;
        }

        profitable++;
        this.logger.log(
          `✅ PROFITABLE: ${itemType.name} - ${bestSourceOrder.price} → ${competitiveDestOrder.price} (gain ${competitiveDestOrder.price - bestSourceOrder.price} ISK)`,
        );

        const opportunity = await this.calculateCrossRegionArbitrageOpportunity(
          bestSourceOrder,
          competitiveDestOrder,
          itemType,
          Math.min(bestSourceOrder.volume, competitiveDestOrder.volume),
        );

        // DEBUG: Log opportunity calculation result for ALL items
        if (opportunity) {
          this.logger.log(
            `💰 OPPORTUNITY: ${itemType.name} - Margin: ${opportunity.margin}%, Profit: ${opportunity.possibleProfit} ISK`,
          );
          const meetsFilter = this.meetsFilterCriteria(opportunity, filters);
          if (!meetsFilter) {
            this.logger.log(
              `❌ FILTERED OUT: ${itemType.name} - Does not meet filter criteria`,
            );
          }
        } else {
          this.logger.log(
            `⚠️ NULL RESULT: ${itemType.name} - Opportunity calculation returned null (check calculateCrossRegionArbitrageOpportunity)`,
          );
        }

        if (opportunity && this.meetsFilterCriteria(opportunity, filters)) {
          opportunities.push(opportunity);
        }
      }
    }

    // DEBUG: Log summary for debugging
    this.logger.log(
      `🔍 DEBUG: ${itemType.name} - Comparisons: ${comparisons}, Unprofitable: ${unprofitable}, Profitable: ${profitable}, Final opportunities: ${opportunities.length}`,
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
        this.logger.log(
          `🔍 DEBUG: Station info lookup failed - source: ${!!sourceStation}, destination: ${!!destinationStation}`,
        );
        this.logger.log(
          `🔍 DEBUG: Source locationId: ${sourceSellOrder.locationId}, Dest locationId: ${destinationSellOrder.locationId}`,
        );
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

      // Get trading metrics for this item (temporarily disable optimization to debug BigInt error)
      // const preCalculatedMetrics = tradingMetricsMap?.get(itemType.id);
      // const tradingMetrics = preCalculatedMetrics || (await this.getTradingMetrics(itemType.id));
      const tradingMetrics = await this.getTradingMetrics(itemType.id);

      // NEW STREAMLINED FORMAT
      return {
        // Core item info
        itemTypeId: Number(itemType.id), // Convert BigInt to number for JSON serialization
        itemTypeName: itemType.name,

        // Hub routing (solar system names)
        fromHub: sourceStation.solarSystemName,
        toHub: destinationStation.solarSystemName,

        // Key metrics for trading decisions
        margin: (grossMargin / sourceBuyPrice) * 100, // Gross margin percentage
        possibleProfit: netProfit, // Net profit in ISK
        tradesPerWeek: tradingMetrics.tradesPerWeek,
        totalAmountTradedPerWeek: tradingMetrics.totalAmountTradedPerWeek,
        iskPerM3: profitPerM3, // Profit density (ISK per cubic meter)

        // Detailed breakdown (for advanced users)
        details: {
          itemTypeId: Number(itemType.id), // Convert BigInt to number for JSON serialization
          itemTypeName: itemType.name,
          volume: itemType.volume ?? 0,

          buyHub: {
            stationId: sourceSellOrder.locationId.toString(),
            stationName: sourceStation.name,
            solarSystemName: sourceStation.solarSystemName,
            regionId: sourceStation.regionId,
            regionName: sourceStation.regionName,
            bestBuyPrice: sourceBuyPrice,
            availableVolume: sourceSellOrder.volume,
            totalValue: totalCost,
          },

          sellHub: {
            stationId: destinationSellOrder.locationId.toString(),
            stationName: destinationStation.name,
            solarSystemName: destinationStation.solarSystemName,
            regionId: destinationStation.regionId,
            regionName: destinationStation.regionName,
            bestSellPrice: destinationSellPrice,
            demandVolume: destinationSellOrder.volume,
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
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `🔍 DEBUG: Exception in calculateCrossRegionArbitrageOpportunity for ${itemType.name}: ${errorMessage}`,
      );
      this.logger.error(
        `🔍 DEBUG: Source: ${sourceSellOrder.locationId} (${sourceSellOrder.price}), Dest: ${destinationSellOrder.locationId} (${destinationSellOrder.price})`,
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

      // Get trading metrics for this item
      const tradingMetrics = await this.getTradingMetrics(itemType.id);

      // NEW STREAMLINED FORMAT - same as cross-region method
      return {
        // Core item info
        itemTypeId: Number(itemType.id), // Convert BigInt to number for JSON serialization
        itemTypeName: itemType.name,

        // Hub routing (solar system names)
        fromHub: buyStation.solarSystemName,
        toHub: sellStation.solarSystemName,

        // Key metrics for trading decisions
        margin: (grossMargin / buyPrice) * 100, // Gross margin percentage
        possibleProfit: netProfit, // Net profit in ISK
        tradesPerWeek: tradingMetrics.tradesPerWeek,
        totalAmountTradedPerWeek: tradingMetrics.totalAmountTradedPerWeek,
        iskPerM3: profitPerM3, // Profit density (ISK per cubic meter)

        // Detailed breakdown (for advanced users)
        details: {
          itemTypeId: Number(itemType.id), // Convert BigInt to number for JSON serialization
          itemTypeName: itemType.name,
          volume: itemType.volume ?? 0,

          buyHub: {
            stationId: buyOrder.locationId.toString(),
            stationName: buyStation.name,
            solarSystemName: buyStation.solarSystemName,
            regionId: buyStation.regionId,
            regionName: buyStation.regionName,
            bestBuyPrice: buyPrice,
            availableVolume: buyOrder.volume,
            totalValue: totalCost,
          },

          sellHub: {
            stationId: sellOrder.locationId.toString(),
            stationName: sellStation.name,
            solarSystemName: sellStation.solarSystemName,
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
   * Get station information with region and solar system data
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
      solarSystemName: station.solarSystem.name, // Hub name like "Jita", "Amarr"
      regionId: station.solarSystem.region.id,
      regionName: station.solarSystem.region.name,
    };
  }

  /**
   * Get trading metrics from historical data (trades per week, volume per week)
   */
  private async getTradingMetrics(itemTypeId: number): Promise<{
    tradesPerWeek: number;
    totalAmountTradedPerWeek: number;
  }> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weeklyTrades = await this.prisma.marketOrderTrade.findMany({
      where: {
        typeId: itemTypeId,
        scanDate: {
          gte: oneWeekAgo,
        },
        isBuyOrder: false, // Only count actual sales (sell order completions)
      },
      select: {
        amount: true,
      },
    });

    const tradesPerWeek = weeklyTrades.length;
    const totalAmountTradedPerWeek = weeklyTrades.reduce(
      (sum, trade) => sum + Number(trade.amount),
      0,
    );

    return {
      tradesPerWeek,
      totalAmountTradedPerWeek,
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
    if (!filters) {
      this.logger.log(
        `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - No filters provided, PASS`,
      );
      return true;
    }

    this.logger.log(
      `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - Checking filters...`,
    );
    this.logger.log(`🔍 FILTER DEBUG: Filters: ${JSON.stringify(filters)}`);

    // Hub filtering (case-insensitive)
    if (
      filters.fromHub &&
      opportunity.fromHub.toLowerCase() !== filters.fromHub.toLowerCase()
    ) {
      this.logger.log(
        `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - FAILED fromHub filter: ${opportunity.fromHub} !== ${filters.fromHub}`,
      );
      return false;
    }

    if (
      filters.toHub &&
      opportunity.toHub.toLowerCase() !== filters.toHub.toLowerCase()
    ) {
      this.logger.log(
        `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - FAILED toHub filter: ${opportunity.toHub} !== ${filters.toHub}`,
      );
      return false;
    }

    // Updated field access for new streamlined format
    if (filters.minProfit && opportunity.possibleProfit < filters.minProfit) {
      this.logger.log(
        `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - FAILED minProfit filter: ${opportunity.possibleProfit} < ${filters.minProfit}`,
      );
      return false;
    }

    if (
      filters.minMarginPercent &&
      opportunity.margin < filters.minMarginPercent
    ) {
      this.logger.log(
        `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - FAILED minMarginPercent filter: ${opportunity.margin}% < ${filters.minMarginPercent}%`,
      );
      return false;
    }

    if (
      filters.maxCargoVolume &&
      (opportunity.details?.logistics.totalCargo ?? 0) > filters.maxCargoVolume
    ) {
      this.logger.log(
        `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - FAILED maxCargoVolume filter: ${opportunity.details?.logistics.totalCargo} > ${filters.maxCargoVolume}`,
      );
      return false;
    }

    if (
      filters.maxInvestment &&
      (opportunity.details?.costs.totalCost ?? 0) > filters.maxInvestment
    ) {
      this.logger.log(
        `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - FAILED maxInvestment filter: ${opportunity.details?.costs.totalCost} > ${filters.maxInvestment}`,
      );
      return false;
    }

    if (
      filters.minProfitPerM3 &&
      opportunity.iskPerM3 < filters.minProfitPerM3
    ) {
      this.logger.log(
        `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - FAILED minProfitPerM3 filter: ${opportunity.iskPerM3} < ${filters.minProfitPerM3}`,
      );
      return false;
    }

    if (
      filters.excludeHighRisk &&
      opportunity.details?.metadata.confidence === 'low'
    ) {
      this.logger.log(
        `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - FAILED excludeHighRisk filter: confidence is low`,
      );
      return false;
    }

    this.logger.log(
      `🔍 FILTER DEBUG: ${opportunity.itemTypeName} - PASSED all filters`,
    );
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
    const sortBy = filters?.sortBy || 'margin'; // Changed default to margin
    const sortOrder = filters?.sortOrder || 'desc';

    opportunities.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'margin':
          aValue = a.margin; // Use new streamlined field
          bValue = b.margin;
          break;
        case 'profit':
          aValue = a.possibleProfit; // Use new streamlined field
          bValue = b.possibleProfit;
          break;
        case 'profitPerM3':
          aValue = a.iskPerM3; // Use new streamlined field
          bValue = b.iskPerM3;
          break;
        case 'roi':
          aValue = a.details?.profitAnalysis.roi ?? 0; // Access via details
          bValue = b.details?.profitAnalysis.roi ?? 0;
          break;
        case 'tradesPerWeek':
          aValue = a.tradesPerWeek; // New sorting option
          bValue = b.tradesPerWeek;
          break;
        default: // Default to margin now
          aValue = a.margin;
          bValue = b.margin;
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

  /**
   * Find arbitrage opportunities for a specific route (source → destination)
   * Much more efficient than analyzing all possible routes
   */
  async findRouteArbitrageOpportunities(
    sourceStationId: bigint,
    destStationId: bigint,
    filters: ArbitrageFilters = {},
  ): Promise<ArbitrageOpportunity[]> {
    this.logger.log(
      `⏱️  Starting route arbitrage analysis: ${sourceStationId} → ${destStationId}...`,
    );
    const totalStartTime = Date.now();

    // Get liquid items at the destination station with their trading metrics
    const liquidItems = await this.liquidityAnalyzer.getDestinationLiquidity(
      destStationId,
      {
        minDaysPerWeek: 4, // 4+ days per week traded (new liquidity logic)
        minValue: 1000000, // 1M ISK minimum average trade value
      },
    );

    this.logger.log(`Found ${liquidItems.length} liquid items at destination`);

    if (liquidItems.length === 0) {
      this.logger.warn(
        'No liquid items found at destination - no arbitrage opportunities',
      );
      return [];
    }

    // Extract type IDs for ESI calls (temporarily revert to old format)
    const liquidItemIds = liquidItems; // Already an array of type IDs

    // Get market prices for this specific route
    this.logger.log(
      `⏱️  Starting ESI data fetch for ${liquidItemIds.length} items...`,
    );
    const esiStartTime = Date.now();

    const rawMarketPrices = await this.esiService.fetchMarketPricesForRoute(
      sourceStationId,
      destStationId,
      liquidItemIds,
    );

    const esiDuration = Date.now() - esiStartTime;
    this.logger.log(`⏱️  ESI data fetch completed in ${esiDuration}ms`);
    this.logger.log(`⏱️  Starting arbitrage analysis...`);

    // Convert ESI data to our internal format
    const allMarketPrices: MarketPrice[] = rawMarketPrices.map(
      convertEsiToMarketPrice,
    );

    this.logger.log(
      `Processing ${allMarketPrices.length} market prices for route arbitrage analysis`,
    );

    // Group prices by item type for analysis
    const pricesByItem = new Map<string, MarketPrice[]>();
    allMarketPrices.forEach((price) => {
      const key = price.itemTypeId.toString();
      if (!pricesByItem.has(key)) {
        pricesByItem.set(key, []);
      }
      pricesByItem.get(key)!.push(price);
    });

    this.logger.log(
      `Grouped market prices into ${pricesByItem.size} unique items`,
    );

    const opportunities: ArbitrageOpportunity[] = [];

    // Pre-fetch all item type data to avoid N+1 database queries
    const uniqueItemTypeIds = Array.from(pricesByItem.keys()).map((id) =>
      parseInt(id),
    );
    const itemTypes = await this.prisma.itemType.findMany({
      where: { id: { in: uniqueItemTypeIds } },
      select: { id: true, name: true, volume: true },
    });
    const itemTypeMap = new Map(itemTypes.map((item) => [item.id, item]));

    // Analyze each item for arbitrage opportunities on this specific route
    let itemIndex = 0;
    for (const [itemTypeId, prices] of pricesByItem) {
      itemIndex++;
      this.logger.log(
        `🔍 PROCESSING ITEM ${itemIndex}/${pricesByItem.size}: ID ${itemTypeId} with ${prices.length} prices`,
      );

      const itemOpportunities = await this.analyzeItemArbitrage(
        parseInt(itemTypeId),
        prices,
        filters,
        itemTypeMap,
      );

      this.logger.log(
        `🔍 ITEM ${itemTypeId} RESULT: ${itemOpportunities.length} opportunities found`,
      );
      opportunities.push(...itemOpportunities);
    }

    this.logger.log(
      `Found ${opportunities.length} route arbitrage opportunities`,
    );

    // Apply filters and sorting
    const filteredOpportunities = this.applyFilters(opportunities, filters);
    this.logger.debug(
      `${opportunities.length} → ${filteredOpportunities.length} opportunities after filtering`,
    );

    const sortedOpportunities = this.sortOpportunities(
      filteredOpportunities,
      filters,
    );

    const totalDuration = Date.now() - totalStartTime;
    this.logger.log(
      `⏱️  Route arbitrage analysis completed: ${sortedOpportunities.length} opportunities found in ${totalDuration}ms`,
    );

    return sortedOpportunities;
  }
}
