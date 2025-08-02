import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ArbitrageService } from '../arbitrage/arbitrage.service';
import { ArbitrageOpportunity } from '../arbitrage/interfaces/arbitrage.interface';
import {
  CycleOpportunitiesResponse,
  CycleAllocationResult,
  CycleOpportunity,
  CycleFilters,
  PackingResult,
  PackedItem,
  AlgorithmComparison,
} from './interfaces/cycle.interface';

@Injectable()
export class CycleManagementService {
  private readonly logger = new Logger(CycleManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly arbitrageService: ArbitrageService,
  ) {}

  /**
   * Get cycle opportunities with capital allocation and transport cost analysis
   * This is the main method for POC cycle planning
   */
  async getCycleOpportunities(
    sourceHub: string,
    totalCapital: number,
    allocations: Record<string, number> = {
      amarr: 0.5,
      dodixie: 0.3,
      hek: 0.1,
      rens: 0.1,
    },
    filters: CycleFilters = {},
  ): Promise<CycleOpportunitiesResponse> {
    const cycleId = `cycle_${Date.now()}`;
    const defaultFilters = {
      minMarginPercent: 15,
      minLiquidity: 1, // Temporarily reduced from 4 to 1 for debugging
      maxItemsPerHub: 20,
      ...filters,
    };

    // Transport costs per 60km³ shipment (based on jumps)
    const transportCosts: Record<string, number> = {
      amarr: 46 * 1500000, // 46 jumps × 1.5M ISK
      dodixie: 16 * 1500000, // 16 jumps × 1.5M ISK
      hek: 20 * 1500000, // 20 jumps × 1.5M ISK
      rens: 26 * 1500000, // 26 jumps × 1.5M ISK
    };

    this.logger.log(
      `Starting cycle planning: ${sourceHub} → ${Object.keys(allocations).join(', ')} with ${totalCapital.toLocaleString()} ISK`,
    );

    // Get all arbitrage opportunities
    const allOpportunities =
      await this.arbitrageService.findMultiHubArbitrageOpportunities({
        sourceHub,
        destinationHubs: Object.keys(allocations),
        filters: {
          minMarginPercent: defaultFilters.minMarginPercent,
          sortBy: 'profitPerM3',
          sortOrder: 'desc',
        },
      });

    // Group opportunities by destination hub (case-insensitive)
    const opportunitiesByHub = new Map<string, ArbitrageOpportunity[]>();
    allOpportunities.forEach((opp) => {
      const hubKey = opp.toHub.toLowerCase(); // Normalize to lowercase
      if (!opportunitiesByHub.has(hubKey)) {
        opportunitiesByHub.set(hubKey, []);
      }
      opportunitiesByHub.get(hubKey)!.push(opp);
    });

    // Process each hub allocation
    const results: Record<string, CycleAllocationResult> = {};
    let totalOpportunities = 0;
    let totalValue = 0;
    let totalProfit = 0;
    let totalTransportCost = 0;

    for (const [hub, percentage] of Object.entries(allocations)) {
      const hubCapital = totalCapital * percentage;
      const transportCost = transportCosts[hub] || 0;
      const opportunities = opportunitiesByHub.get(hub) || [];

      this.logger.log(
        `Processing ${hub}: ${hubCapital.toLocaleString()} ISK (${(percentage * 100).toFixed(1)}%), ${opportunities.length} opportunities`,
      );

      // Create optimally packed shipments for this hub
      const cycleOpportunities = this.createOptimalShipments(
        opportunities,
        hubCapital,
        transportCost,
        defaultFilters.maxItemsPerHub,
      );

      // Calculate totals for this hub
      const hubValue = cycleOpportunities.reduce(
        (sum, opp) => sum + opp.totalCost,
        0,
      );
      const hubProfit = cycleOpportunities.reduce(
        (sum, opp) => sum + opp.netProfitAfterTransport,
        0,
      );
      const hubTransportCost = cycleOpportunities.reduce(
        (sum, opp) => sum + opp.transportCost,
        0,
      );

      results[hub] = {
        hub,
        capital: hubCapital,
        percentage,
        transportCost,
        maxShipments: Math.floor(hubCapital / transportCost),
        opportunities: cycleOpportunities,
        totalValue: hubValue,
        totalProfit: hubProfit,
        totalTransportCost: hubTransportCost,
      };

      totalOpportunities += cycleOpportunities.length;
      totalValue += hubValue;
      totalProfit += hubProfit;
      totalTransportCost += hubTransportCost;
    }

    const averageMargin =
      allOpportunities.length > 0
        ? allOpportunities.reduce((sum, opp) => sum + opp.margin, 0) /
          allOpportunities.length
        : 0;

    this.logger.log(
      `Cycle planning complete: ${totalOpportunities} opportunities, ${totalValue.toLocaleString()} ISK value, ${totalProfit.toLocaleString()} ISK profit`,
    );

    return {
      cycleId,
      sourceHub,
      totalCapital,
      allocations: results,
      summary: {
        totalOpportunities,
        totalValue,
        totalProfit,
        totalTransportCost,
        averageMargin,
      },
    };
  }

  /**
   * Create optimally packed shipments using bin-packing algorithm
   * Properly calculates quantities based on market liquidity and budget constraints
   */
  private createOptimalShipments(
    opportunities: ArbitrageOpportunity[],
    hubCapital: number,
    transportCostPerShipment: number,
    maxItems: number,
  ): CycleOpportunity[] {
    const CARGO_CAPACITY = 60000; // 60km³ per shipment
    const result: CycleOpportunity[] = [];
    let remainingBudget = hubCapital;

    // Filter and sort opportunities by profit per m³ (most efficient first)
    const viableOpportunities = opportunities
      .filter((opp) => {
        const buyPrice = opp.details?.costs.buyPrice || 0;
        const volume = opp.details?.volume || 1;
        const hasLiquidity = opp.totalAmountTradedPerWeek > 0;

        return (
          buyPrice > 0 &&
          volume > 0 &&
          buyPrice <= remainingBudget && // Can afford at least one
          hasLiquidity // Has trading volume data
        );
      })
      .slice(0, maxItems)
      .sort((a, b) => b.iskPerM3 - a.iskPerM3);

    this.logger.log(
      `Starting shipment packing with ${viableOpportunities.length} viable opportunities, budget: ${remainingBudget.toLocaleString()} ISK`,
    );

    // Keep creating shipments until budget or opportunities are exhausted
    let shipmentNumber = 1;
    while (
      remainingBudget > transportCostPerShipment &&
      viableOpportunities.length > 0
    ) {
      const shipmentItems = this.packSingleShipment(
        viableOpportunities,
        remainingBudget,
        transportCostPerShipment,
        CARGO_CAPACITY,
      );

      if (shipmentItems.length === 0) {
        this.logger.log(
          `No more profitable items can fit in shipment ${shipmentNumber}, stopping`,
        );
        break;
      }

      // Calculate transport cost allocation for this shipment
      const shipmentTotalCargo = shipmentItems.reduce(
        (sum, item) => sum + item.totalCargo,
        0,
      );
      const transportCostPerItem =
        transportCostPerShipment / shipmentItems.length; // Split evenly

      // Add items to result with proper transport cost allocation
      shipmentItems.forEach((item) => {
        const netProfitAfterTransport = item.profit - transportCostPerItem;

        // Final check: only add if still profitable after precise transport cost allocation
        if (netProfitAfterTransport > 0) {
          result.push({
            ...item,
            transportCost: transportCostPerItem,
            netProfitAfterTransport,
          });
          remainingBudget -= item.totalCost;
        } else {
          this.logger.debug(
            `Filtering out ${item.itemName}: unprofitable after transport (${netProfitAfterTransport.toLocaleString()} ISK)`,
          );
        }
      });

      this.logger.log(
        `Shipment ${shipmentNumber}: ${shipmentItems.length} items, ${shipmentTotalCargo.toFixed(2)}m³, cost: ${shipmentItems.reduce((sum, item) => sum + item.totalCost, 0).toLocaleString()} ISK`,
      );

      shipmentNumber++;
    }

    this.logger.log(
      `Completed packing: ${result.length} items across ${shipmentNumber - 1} shipments, remaining budget: ${remainingBudget.toLocaleString()} ISK`,
    );

    return result;
  }

  /**
   * Pack a single 60km³ shipment with multiple items using bin-packing
   */
  private packSingleShipment(
    opportunities: ArbitrageOpportunity[],
    budget: number,
    transportCost: number,
    cargoCapacity: number,
  ): Omit<CycleOpportunity, 'transportCost' | 'netProfitAfterTransport'>[] {
    const shipmentItems: Omit<
      CycleOpportunity,
      'transportCost' | 'netProfitAfterTransport'
    >[] = [];
    let remainingBudget = budget - transportCost; // Reserve transport cost
    let remainingCargo = cargoCapacity;

    // Try to pack items efficiently
    for (const opp of opportunities) {
      const buyPrice = opp.details?.costs.buyPrice || 0;
      const sellPrice = opp.details?.costs.sellPrice || 0;
      const itemVolume = opp.details?.volume || 1;

      if (buyPrice <= 0 || itemVolume <= 0) continue;

      // Calculate safe quantity based on half week's trading volume
      const safeQuantity = Math.max(
        1,
        Math.floor(opp.totalAmountTradedPerWeek * 0.5),
      );

      // Apply constraints: budget, cargo space, and safe quantity
      const maxAffordable = Math.floor(remainingBudget / buyPrice);
      const maxByVolume = Math.floor(remainingCargo / itemVolume);
      const finalQuantity = Math.min(safeQuantity, maxAffordable, maxByVolume);

      if (finalQuantity <= 0) continue;

      const totalCost = finalQuantity * buyPrice;
      const totalCargo = finalQuantity * itemVolume;
      const profit = finalQuantity * (sellPrice - buyPrice) * (1 - 0.045); // Approximate taxes

      // Estimate transport cost per item (conservative estimate - assume 1 item per shipment worst case)
      const estimatedTransportCostPerItem = transportCost; // Worst case: full transport cost for this item
      const netProfitAfterTransport = profit - estimatedTransportCostPerItem;

      // Only add if it's profitable after transport costs
      if (
        profit > 0 &&
        netProfitAfterTransport > 0 && // Must be profitable after transport
        finalQuantity > 0 && // Must have valid quantity
        totalCargo <= remainingCargo &&
        totalCost <= remainingBudget
      ) {
        shipmentItems.push({
          itemTypeId: opp.itemTypeId,
          itemName: opp.itemTypeName,
          buyPrice,
          sellPrice,
          margin: ((sellPrice - buyPrice) / buyPrice) * 100,
          profit,
          profitPerM3: profit / totalCargo,
          quantity: finalQuantity,
          totalCost,
          totalCargo,
          shipmentsNeeded: 1, // This item is part of 1 shipment
          recordedPriceLow: opp.recordedPriceLow,
          recordedPriceHigh: opp.recordedPriceHigh,
          recordedPriceAverage: opp.recordedPriceAverage,
          liquidity: opp.daysTraded,
        });

        remainingBudget -= totalCost;
        remainingCargo -= totalCargo;

        this.logger.debug(
          `Packed: ${finalQuantity}x ${opp.itemTypeName} (${totalCargo.toFixed(2)}m³, ${totalCost.toLocaleString()} ISK)`,
        );
      }
    }

    return shipmentItems;
  }

  /**
   * ALGORITHM COMPETITION: Compare different packing strategies
   */
  async comparePackingAlgorithms(
    opportunities: ArbitrageOpportunity[],
    budget: number,
    transportCost: number,
    cargoCapacity: number = 60000,
  ): Promise<{
    greedy_current: PackingResult;
    dynamic_optimal: PackingResult;
    hybrid_smart: PackingResult;
    winner: string;
    comparison: AlgorithmComparison;
  }> {
    this.logger.log(
      `🏁 ALGORITHM COMPETITION START - Budget: ${budget.toLocaleString()} ISK`,
    );

    // Run all three algorithms
    const [greedyResult, dynamicResult, hybridResult] = await Promise.all([
      this.packGreedyCurrent(
        opportunities,
        budget,
        transportCost,
        cargoCapacity,
      ),
      this.packDynamicOptimal(
        opportunities,
        budget,
        transportCost,
        cargoCapacity,
      ),
      this.packHybridSmart(opportunities, budget, transportCost, cargoCapacity),
    ]);

    // Determine winner based on profit-to-time ratio
    const algorithms = {
      greedy_current: greedyResult,
      dynamic_optimal: dynamicResult,
      hybrid_smart: hybridResult,
    };

    let winner = 'greedy_current';
    let bestScore =
      greedyResult.totalProfit / Math.max(greedyResult.executionTimeMs, 1);

    Object.entries(algorithms).forEach(([name, result]) => {
      const score = result.totalProfit / Math.max(result.executionTimeMs, 1);
      if (score > bestScore) {
        bestScore = score;
        winner = name;
      }
    });

    return {
      ...algorithms,
      winner,
      comparison: this.createComparison(algorithms),
    };
  }

  /**
   * ALGORITHM 1: Current Greedy (Profit per m³ sorting)
   */
  private async packGreedyCurrent(
    opportunities: ArbitrageOpportunity[],
    budget: number,
    transportCost: number,
    cargoCapacity: number,
  ): Promise<PackingResult> {
    const startTime = performance.now();

    const items: PackedItem[] = [];
    let remainingBudget = budget - transportCost;
    let remainingCargo = cargoCapacity;

    // Sort by profit per m³ (current algorithm)
    const sortedOpps = opportunities
      .filter((opp) => {
        const buyPrice = opp.details?.costs.buyPrice || 0;
        const volume = opp.details?.volume || 1;
        return buyPrice > 0 && volume > 0 && opp.totalAmountTradedPerWeek > 0;
      })
      .sort((a, b) => b.iskPerM3 - a.iskPerM3);

    for (const opp of sortedOpps) {
      const buyPrice = opp.details?.costs.buyPrice || 0;
      const sellPrice = opp.details?.costs.sellPrice || 0;
      const itemVolume = opp.details?.volume || 1;

      const safeQuantity = Math.max(
        1,
        Math.floor(opp.totalAmountTradedPerWeek * 0.5),
      );
      const maxAffordable = Math.floor(remainingBudget / buyPrice);
      const maxByVolume = Math.floor(remainingCargo / itemVolume);
      const finalQuantity = Math.min(safeQuantity, maxAffordable, maxByVolume);

      if (finalQuantity <= 0) continue;

      const totalCost = finalQuantity * buyPrice;
      const totalCargo = finalQuantity * itemVolume;
      const profit = finalQuantity * (sellPrice - buyPrice) * (1 - 0.045);

      if (
        profit > 0 &&
        totalCargo <= remainingCargo &&
        totalCost <= remainingBudget
      ) {
        items.push({
          itemTypeId: opp.itemTypeId,
          itemName: opp.itemTypeName,
          quantity: finalQuantity,
          totalCost,
          totalCargo,
          profit,
          profitPerM3: profit / totalCargo,
          originalOpportunity: {
            fromHub: opp.fromHub,
            toHub: opp.toHub,
            margin: opp.margin,
            possibleProfit: opp.possibleProfit,
            daysTraded: opp.daysTraded,
            totalAmountTradedPerWeek: opp.totalAmountTradedPerWeek,
            iskPerM3: opp.iskPerM3,
            recordedPriceLow: opp.recordedPriceLow,
            recordedPriceHigh: opp.recordedPriceHigh,
            recordedPriceAverage: opp.recordedPriceAverage,
            priceValidation: opp.priceValidation,
            details: opp.details,
          },
        });

        remainingBudget -= totalCost;
        remainingCargo -= totalCargo;
      }
    }

    const endTime = performance.now();
    const totalProfit = items.reduce((sum, item) => sum + item.profit, 0);
    const totalCargo = items.reduce((sum, item) => sum + item.totalCargo, 0);

    return {
      items,
      totalProfit,
      cargoUtilization: (totalCargo / cargoCapacity) * 100,
      totalItems: items.length,
      executionTimeMs: endTime - startTime,
      algorithm: 'Greedy (Profit/m³)',
    };
  }

  /**
   * ALGORITHM 2: Dynamic Programming (Optimal Knapsack)
   */
  private async packDynamicOptimal(
    opportunities: ArbitrageOpportunity[],
    budget: number,
    transportCost: number,
    cargoCapacity: number,
  ): Promise<PackingResult> {
    const startTime = performance.now();
    const MAX_EXECUTION_TIME = 60000; // 60 second timeout

    let bestCombination: PackedItem[] = [];
    let bestProfit = 0;

    // Prepare items for DP
    const viableItems = opportunities
      .filter((opp) => {
        const buyPrice = opp.details?.costs.buyPrice || 0;
        return buyPrice > 0 && opp.totalAmountTradedPerWeek > 0;
      })
      .slice(0, 50) // Limit to prevent explosion
      .map((opp) => {
        const buyPrice = opp.details?.costs.buyPrice || 0;
        const sellPrice = opp.details?.costs.sellPrice || 0;
        const itemVolume = opp.details?.volume || 1;
        const safeQuantity = Math.max(
          1,
          Math.floor(opp.totalAmountTradedPerWeek * 0.5),
        );

        return {
          opp,
          buyPrice,
          sellPrice,
          itemVolume,
          maxQuantity: Math.min(
            safeQuantity,
            Math.floor((budget - transportCost) / buyPrice),
          ),
          profitPerUnit: (sellPrice - buyPrice) * (1 - 0.045),
        };
      })
      .filter((item) => item.maxQuantity > 0 && item.profitPerUnit > 0);

    // Simplified DP with branch and bound
    const searchCombinations = (
      index: number,
      currentBudget: number,
      currentCargo: number,
      currentItems: PackedItem[],
      currentProfit: number,
    ) => {
      // Timeout check
      if (performance.now() - startTime > MAX_EXECUTION_TIME) {
        return;
      }

      // Update best if current is better
      if (currentProfit > bestProfit) {
        bestProfit = currentProfit;
        bestCombination = [...currentItems];
      }

      // Base case or pruning
      if (
        index >= viableItems.length ||
        currentBudget <= 0 ||
        currentCargo <= 0
      ) {
        return;
      }

      const item = viableItems[index];

      // Try different quantities for this item
      for (let qty = 0; qty <= item.maxQuantity; qty++) {
        const cost = qty * item.buyPrice;
        const cargo = qty * item.itemVolume;
        const profit = qty * item.profitPerUnit;

        if (cost <= currentBudget && cargo <= currentCargo) {
          const newItems =
            qty > 0
              ? [
                  ...currentItems,
                  {
                    itemTypeId: item.opp.itemTypeId,
                    itemName: item.opp.itemTypeName,
                    quantity: qty,
                    totalCost: cost,
                    totalCargo: cargo,
                    profit,
                    profitPerM3: profit / cargo,
                    originalOpportunity: {
                      fromHub: item.opp.fromHub,
                      toHub: item.opp.toHub,
                      margin: item.opp.margin,
                      possibleProfit: item.opp.possibleProfit,
                      daysTraded: item.opp.daysTraded,
                      totalAmountTradedPerWeek:
                        item.opp.totalAmountTradedPerWeek,
                      iskPerM3: item.opp.iskPerM3,
                      recordedPriceLow: item.opp.recordedPriceLow,
                      recordedPriceHigh: item.opp.recordedPriceHigh,
                      recordedPriceAverage: item.opp.recordedPriceAverage,
                      priceValidation: item.opp.priceValidation,
                      details: item.opp.details,
                    },
                  },
                ]
              : currentItems;

          searchCombinations(
            index + 1,
            currentBudget - cost,
            currentCargo - cargo,
            newItems,
            currentProfit + profit,
          );
        }
      }
    };

    searchCombinations(0, budget - transportCost, cargoCapacity, [], 0);

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    // Log timeout information for dynamic programming
    this.logger.log(
      `🎯 Dynamic Programming completed in ${executionTime.toFixed(1)}ms (timeout: ${MAX_EXECUTION_TIME}ms, used: ${((executionTime / MAX_EXECUTION_TIME) * 100).toFixed(1)}%)`,
    );
    const totalCargo = bestCombination.reduce(
      (sum, item) => sum + item.totalCargo,
      0,
    );

    return {
      items: bestCombination,
      totalProfit: bestProfit,
      cargoUtilization: (totalCargo / cargoCapacity) * 100,
      totalItems: bestCombination.length,
      executionTimeMs: endTime - startTime,
      algorithm: 'Dynamic Programming (Optimal)',
    };
  }

  /**
   * ALGORITHM 3: Hybrid Smart (80% efficient items + 20% highest profit items)
   */
  private async packHybridSmart(
    opportunities: ArbitrageOpportunity[],
    budget: number,
    transportCost: number,
    cargoCapacity: number,
  ): Promise<PackingResult> {
    const startTime = performance.now();

    const items: PackedItem[] = [];
    let remainingBudget = budget - transportCost;
    let remainingCargo = cargoCapacity;

    const viableOpps = opportunities.filter((opp) => {
      const buyPrice = opp.details?.costs.buyPrice || 0;
      const volume = opp.details?.volume || 1;
      return buyPrice > 0 && volume > 0 && opp.totalAmountTradedPerWeek > 0;
    });

    // Phase 1: Fill 80% of space with highest profit/m³ items
    const efficiencyTarget = cargoCapacity * 0.8;
    const efficiencyOpps = [...viableOpps].sort(
      (a, b) => b.iskPerM3 - a.iskPerM3,
    );

    for (const opp of efficiencyOpps) {
      if (remainingCargo <= cargoCapacity * 0.2) break; // Leave 20% for phase 2

      const buyPrice = opp.details?.costs.buyPrice || 0;
      const sellPrice = opp.details?.costs.sellPrice || 0;
      const itemVolume = opp.details?.volume || 1;

      const safeQuantity = Math.max(
        1,
        Math.floor(opp.totalAmountTradedPerWeek * 0.5),
      );
      const maxAffordable = Math.floor(remainingBudget / buyPrice);
      const maxByVolume = Math.floor(remainingCargo / itemVolume);
      const finalQuantity = Math.min(safeQuantity, maxAffordable, maxByVolume);

      if (finalQuantity <= 0) continue;

      const totalCost = finalQuantity * buyPrice;
      const totalCargo = finalQuantity * itemVolume;
      const profit = finalQuantity * (sellPrice - buyPrice) * (1 - 0.045);

      if (profit > 0) {
        items.push({
          itemTypeId: opp.itemTypeId,
          itemName: opp.itemTypeName,
          quantity: finalQuantity,
          totalCost,
          totalCargo,
          profit,
          profitPerM3: profit / totalCargo,
          originalOpportunity: {
            fromHub: opp.fromHub,
            toHub: opp.toHub,
            margin: opp.margin,
            possibleProfit: opp.possibleProfit,
            daysTraded: opp.daysTraded,
            totalAmountTradedPerWeek: opp.totalAmountTradedPerWeek,
            iskPerM3: opp.iskPerM3,
            recordedPriceLow: opp.recordedPriceLow,
            recordedPriceHigh: opp.recordedPriceHigh,
            recordedPriceAverage: opp.recordedPriceAverage,
            priceValidation: opp.priceValidation,
            details: opp.details,
          },
        });

        remainingBudget -= totalCost;
        remainingCargo -= totalCargo;
      }
    }

    // Phase 2: Fill remaining space with highest absolute profit items
    const profitOpps = viableOpps
      .filter(
        (opp) => !items.some((item) => item.itemTypeId === opp.itemTypeId),
      )
      .map((opp) => {
        const buyPrice = opp.details?.costs.buyPrice || 0;
        const sellPrice = opp.details?.costs.sellPrice || 0;
        const safeQuantity = Math.max(
          1,
          Math.floor(opp.totalAmountTradedPerWeek * 0.5),
        );
        const maxAffordable = Math.floor(remainingBudget / buyPrice);
        const maxByVolume = Math.floor(
          remainingCargo / (opp.details?.volume || 1),
        );
        const quantity = Math.min(safeQuantity, maxAffordable, maxByVolume);
        const totalProfit = quantity * (sellPrice - buyPrice) * (1 - 0.045);

        return { opp, quantity, totalProfit };
      })
      .filter((item) => item.quantity > 0 && item.totalProfit > 0)
      .sort((a, b) => b.totalProfit - a.totalProfit);

    for (const { opp, quantity } of profitOpps) {
      if (remainingCargo <= 0 || remainingBudget <= 0) break;

      const buyPrice = opp.details?.costs.buyPrice || 0;
      const sellPrice = opp.details?.costs.sellPrice || 0;
      const itemVolume = opp.details?.volume || 1;

      const totalCost = quantity * buyPrice;
      const totalCargo = quantity * itemVolume;
      const profit = quantity * (sellPrice - buyPrice) * (1 - 0.045);

      if (totalCost <= remainingBudget && totalCargo <= remainingCargo) {
        items.push({
          itemTypeId: opp.itemTypeId,
          itemName: opp.itemTypeName,
          quantity,
          totalCost,
          totalCargo,
          profit,
          profitPerM3: profit / totalCargo,
          originalOpportunity: {
            fromHub: opp.fromHub,
            toHub: opp.toHub,
            margin: opp.margin,
            possibleProfit: opp.possibleProfit,
            daysTraded: opp.daysTraded,
            totalAmountTradedPerWeek: opp.totalAmountTradedPerWeek,
            iskPerM3: opp.iskPerM3,
            recordedPriceLow: opp.recordedPriceLow,
            recordedPriceHigh: opp.recordedPriceHigh,
            recordedPriceAverage: opp.recordedPriceAverage,
            priceValidation: opp.priceValidation,
            details: opp.details,
          },
        });

        remainingBudget -= totalCost;
        remainingCargo -= totalCargo;
      }
    }

    const endTime = performance.now();
    const totalProfit = items.reduce((sum, item) => sum + item.profit, 0);
    const totalCargo = items.reduce((sum, item) => sum + item.totalCargo, 0);

    return {
      items,
      totalProfit,
      cargoUtilization: (totalCargo / cargoCapacity) * 100,
      totalItems: items.length,
      executionTimeMs: endTime - startTime,
      algorithm: 'Hybrid Smart (80%/20%)',
    };
  }

  /**
   * Create comparison analysis
   */
  private createComparison(
    algorithms: Record<string, PackingResult>,
  ): AlgorithmComparison {
    const results = Object.entries(algorithms);

    // Find which algorithm achieved each metric
    const profitLeader = results.reduce((best, current) =>
      current[1].totalProfit > best[1].totalProfit ? current : best,
    );

    const utilizationLeader = results.reduce((best, current) =>
      current[1].cargoUtilization > best[1].cargoUtilization ? current : best,
    );

    const speedLeader = results.reduce((best, current) =>
      current[1].executionTimeMs < best[1].executionTimeMs ? current : best,
    );

    const maxProfit = profitLeader[1].totalProfit;
    const maxUtilization = utilizationLeader[1].cargoUtilization;
    const minTime = speedLeader[1].executionTimeMs;
    const minProfit = Math.min(...results.map(([_, r]) => r.totalProfit));
    const maxTime = Math.max(...results.map(([_, r]) => r.executionTimeMs));

    return {
      maxProfit,
      maxUtilization,
      minTime,
      profitDifference: maxProfit - minProfit,
      speedDifference: maxTime - minTime,
      recommendation: this.getRecommendation(algorithms),
      // Enhanced stats showing which algorithm achieved each metric
      winners: {
        bestProfit: {
          algorithm: profitLeader[0],
          value: profitLeader[1].totalProfit,
          display: `${profitLeader[1].algorithm} achieved highest profit: ${profitLeader[1].totalProfit.toLocaleString()} ISK`,
        },
        bestUtilization: {
          algorithm: utilizationLeader[0],
          value: utilizationLeader[1].cargoUtilization,
          display: `${utilizationLeader[1].algorithm} achieved best cargo utilization: ${utilizationLeader[1].cargoUtilization.toFixed(2)}%`,
        },
        fastestExecution: {
          algorithm: speedLeader[0],
          value: speedLeader[1].executionTimeMs,
          display: `${speedLeader[1].algorithm} was fastest: ${speedLeader[1].executionTimeMs.toFixed(1)}ms`,
        },
      },
    };
  }

  /**
   * Get algorithm recommendation based on performance
   */
  private getRecommendation(algorithms: Record<string, PackingResult>): string {
    const results = Object.entries(algorithms);
    const [bestName] = results.reduce((best, current) => {
      const [bestAlgo, bestResult] = best;
      const [currentAlgo, currentResult] = current;

      // Score = profit per ISK * utilization% / time penalty
      const bestScore =
        ((bestResult.totalProfit / 1000000) *
          (bestResult.cargoUtilization / 100)) /
        Math.max(bestResult.executionTimeMs / 100, 1);
      const currentScore =
        ((currentResult.totalProfit / 1000000) *
          (currentResult.cargoUtilization / 100)) /
        Math.max(currentResult.executionTimeMs / 100, 1);

      return currentScore > bestScore ? current : best;
    });

    return `${bestName} offers the best balance of profit, efficiency, and speed`;
  }

  /**
   * Create a new trading cycle from greedy algorithm results
   */
  async createCycle(request: {
    sourceHub: string;
    totalCapital: number;
    hubAllocations?: { [hub: string]: number };
    cargoCapacity?: number;
    minProfitMargin?: number;
    minLiquidity?: number;
    name?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    this.logger.log(
      `🔄 Creating cycle: ${request.sourceHub} → Multiple hubs, Capital: ${request.totalCapital.toLocaleString()} ISK`,
    );

    // Default configurations
    const defaultAllocations = {
      amarr: 0.5,
      dodixie: 0.3,
      hek: 0.1,
      rens: 0.1,
    };

    const hubAllocations = request.hubAllocations || defaultAllocations;
    const cargoCapacity = request.cargoCapacity || 60000;
    const minProfitMargin = request.minProfitMargin || 0.15;
    const minLiquidity = request.minLiquidity || 4;

    // Transport costs (1.5M ISK per jump for 60km³)
    const transportCosts = {
      amarr: 69000000, // 46 jumps
      dodixie: 24000000, // 16 jumps
      hek: 30000000, // 20 jumps
      rens: 39000000, // 26 jumps
    };

    try {
      // Create the cycle record
      const cycle = await this.prisma.tradingCycle.create({
        data: {
          name: request.name || `${request.sourceHub} Multi-Hub Cycle`,
          sourceHub: request.sourceHub.toLowerCase(),
          totalCapital: BigInt(Math.round(request.totalCapital)),
          cargoCapacity,
          minProfitMargin,
          minLiquidity,
          transportCosts: transportCosts as any,
          hubAllocations: hubAllocations as any,
          startDate: request.startDate,
          endDate: request.endDate,
          status: 'PLANNED',
        },
      });

      this.logger.log(`✅ Created cycle ${cycle.id}`);

      // For each destination hub, get opportunities and create cycle items
      const allCycleItems: any[] = [];
      let totalPlannedProfit = 0;
      let totalPlannedCost = 0;

      for (const [destinationHub, allocation] of Object.entries(
        hubAllocations,
      )) {
        const hubCapital = Math.floor(request.totalCapital * allocation);
        const hubTransportCost = transportCosts[destinationHub] || 0;

        this.logger.log(
          `📊 Processing ${destinationHub}: ${hubCapital.toLocaleString()} ISK (${(allocation * 100).toFixed(1)}%)`,
        );

        // Get opportunities for this hub using the arbitrage service
        const hubOpportunities =
          await this.arbitrageService.findMultiHubArbitrageOpportunities({
            sourceHub: request.sourceHub,
            destinationHubs: [destinationHub],
            filters: {
              minMarginPercent: minProfitMargin * 100, // Convert to percentage
              sortBy: 'profitPerM3',
              sortOrder: 'desc',
              limit: 100,
            },
          });

        // Filter by liquidity (days traded per week)
        const liquidOpportunities = hubOpportunities.filter(
          (opp) => opp.daysTraded >= minLiquidity,
        );

        // Use the greedy packing algorithm from our algorithm competition
        const packingResult = await this.packGreedyCurrent(
          liquidOpportunities,
          hubCapital,
          hubTransportCost,
          cargoCapacity,
        );

        // Create cycle items from the packing results
        for (const item of packingResult.items) {
          const cycleItem = await this.prisma.cycleItem.create({
            data: {
              cycleId: cycle.id,
              itemTypeId: item.itemTypeId,
              itemName: item.itemName,
              sourceHub: request.sourceHub.toLowerCase(),
              destinationHub: destinationHub.toLowerCase(),
              buyPrice: BigInt(Math.round(item.totalCost / item.quantity)),
              sellPrice: BigInt(
                Math.round(
                  item.originalOpportunity.priceValidation?.validatedPrice || 0,
                ),
              ),
              plannedQuantity: item.quantity,
              totalCargo: item.totalCargo,
              totalCost: BigInt(Math.round(item.totalCost)),
              expectedProfit: BigInt(Math.round(item.profit)),
              transportCost: BigInt(
                Math.round(hubTransportCost / packingResult.items.length),
              ), // Split evenly
              netProfit: BigInt(
                Math.round(
                  item.profit - hubTransportCost / packingResult.items.length,
                ),
              ),
              margin: item.originalOpportunity.margin,
              profitPerM3: BigInt(Math.round(item.profitPerM3)),
              daysTraded: item.originalOpportunity.daysTraded,
              totalAmountTradedPerWeek:
                item.originalOpportunity.totalAmountTradedPerWeek,
              recordedPriceLow: BigInt(
                Math.round(item.originalOpportunity.recordedPriceLow),
              ),
              recordedPriceHigh: BigInt(
                Math.round(item.originalOpportunity.recordedPriceHigh),
              ),
              recordedPriceAvg: BigInt(
                Math.round(item.originalOpportunity.recordedPriceAverage),
              ),
              rawMarketPrice: BigInt(
                Math.round(
                  item.originalOpportunity.priceValidation?.rawMarketPrice || 0,
                ),
              ),
              validatedPrice: BigInt(
                Math.round(
                  item.originalOpportunity.priceValidation?.validatedPrice || 0,
                ),
              ),
              priceWasAdjusted:
                item.originalOpportunity.priceValidation?.wasAdjusted || false,
              priceAdjustment: BigInt(
                Math.round(
                  item.originalOpportunity.priceValidation?.adjustment || 0,
                ),
              ),
              status: 'PLANNED',
            },
          });

          allCycleItems.push(cycleItem);
        }

        totalPlannedProfit += packingResult.totalProfit;
        totalPlannedCost += packingResult.items.reduce(
          (sum, item) => sum + item.totalCost,
          0,
        );

        this.logger.log(
          `✅ ${destinationHub}: ${packingResult.items.length} items, ${packingResult.totalProfit.toLocaleString()} ISK profit`,
        );
      }

      // Update the cycle with totals
      await this.prisma.tradingCycle.update({
        where: { id: cycle.id },
        data: {
          capitalUsed: BigInt(Math.round(totalPlannedCost)),
          totalProfit: BigInt(Math.round(totalPlannedProfit)),
          totalTransportCost: BigInt(
            Math.round(
              Object.values(transportCosts).reduce((a, b) => a + b, 0),
            ),
          ),
        },
      });

      this.logger.log(
        `🎯 Cycle created successfully: ${allCycleItems.length} items, ${totalPlannedProfit.toLocaleString()} ISK projected profit`,
      );

      // Return the created cycle with items
      return await this.prisma.tradingCycle.findUnique({
        where: { id: cycle.id },
        include: {
          cycleItems: true,
          _count: {
            select: {
              cycleItems: true,
              transactions: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`❌ Failed to create cycle: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all cycles with basic information
   */
  async getCycles() {
    return await this.prisma.tradingCycle.findMany({
      include: {
        _count: {
          select: {
            cycleItems: true,
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get detailed cycle information including all items
   */
  async getCycleById(cycleId: string) {
    const cycle = await this.prisma.tradingCycle.findUnique({
      where: { id: cycleId },
      include: {
        cycleItems: {
          orderBy: { netProfit: 'desc' },
        },
        transactions: {
          orderBy: { executedAt: 'desc' },
        },
        _count: {
          select: {
            cycleItems: true,
            transactions: true,
          },
        },
      },
    });

    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    return cycle;
  }

  /**
   * Update cycle status
   */
  async updateCycleStatus(
    cycleId: string,
    status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
  ) {
    return await this.prisma.tradingCycle.update({
      where: { id: cycleId },
      data: {
        status,
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    });
  }

  /**
   * Record a buy/sell transaction
   */
  async recordTransaction(request: {
    cycleId: string;
    cycleItemId?: string;
    transactionType: 'BUY' | 'SELL';
    itemTypeId: number;
    quantity: number;
    pricePerUnit: number;
    locationId: bigint;
    executedAt?: Date;
    estimatedPrice?: number;
  }) {
    const totalValue = request.quantity * request.pricePerUnit;
    const variance = request.estimatedPrice
      ? totalValue - request.quantity * request.estimatedPrice
      : 0;

    const transaction = await this.prisma.cycleTransaction.create({
      data: {
        cycleId: request.cycleId,
        cycleItemId: request.cycleItemId,
        transactionType: request.transactionType,
        itemTypeId: request.itemTypeId,
        quantity: request.quantity,
        pricePerUnit: BigInt(Math.round(request.pricePerUnit)),
        totalValue: BigInt(Math.round(totalValue)),
        locationId: request.locationId,
        executedAt: request.executedAt || new Date(),
        estimatedPrice: request.estimatedPrice
          ? BigInt(Math.round(request.estimatedPrice))
          : null,
        variance: BigInt(Math.round(variance)),
      },
    });

    // Update cycle item status if linked
    if (request.cycleItemId) {
      const newStatus = request.transactionType === 'BUY' ? 'BOUGHT' : 'SOLD';
      await this.prisma.cycleItem.update({
        where: { id: request.cycleItemId },
        data: {
          status: newStatus,
          ...(request.transactionType === 'BUY'
            ? { actualQuantity: request.quantity }
            : {}),
        },
      });
    }

    this.logger.log(
      `📝 Recorded ${request.transactionType}: ${request.quantity}x ${request.itemTypeId} @ ${request.pricePerUnit.toLocaleString()} ISK`,
    );

    return transaction;
  }

  /**
   * Get transactions for a cycle
   */
  async getCycleTransactions(cycleId: string) {
    return await this.prisma.cycleTransaction.findMany({
      where: { cycleId },
      include: {
        itemType: true,
        station: true,
        cycleItem: true,
      },
      orderBy: { executedAt: 'desc' },
    });
  }

  /**
   * Update cycle item status
   */
  async updateCycleItemStatus(
    cycleItemId: string,
    status:
      | 'PLANNED'
      | 'BUYING'
      | 'BOUGHT'
      | 'TRANSPORTING'
      | 'SELLING'
      | 'SOLD'
      | 'CANCELLED',
  ) {
    return await this.prisma.cycleItem.update({
      where: { id: cycleItemId },
      data: { status },
    });
  }

  /**
   * Get shopping list for multi-buy in EVE Online
   */
  async getCycleShoppingList(cycleId: string) {
    const cycle = await this.prisma.tradingCycle.findUnique({
      where: { id: cycleId },
      include: {
        cycleItems: {
          where: {
            status: { in: ['PLANNED', 'BUYING'] },
          },
          orderBy: [{ destinationHub: 'asc' }, { netProfit: 'desc' }],
        },
      },
    });

    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    // Group items by destination hub for separate shipments
    const shipments = {};
    let totalCostAllShipments = 0;

    cycle.cycleItems.forEach((item) => {
      const hub = item.destinationHub;
      if (!shipments[hub]) {
        shipments[hub] = {
          hub,
          items: [],
          totalCost: 0,
          totalProfit: 0,
          itemCount: 0,
        };
      }

      const itemCost = Number(item.totalCost);
      shipments[hub].items.push({
        name: item.itemName,
        quantity: item.plannedQuantity,
        estimatedCostPerUnit: Number(item.buyPrice),
        totalEstimatedCost: itemCost,
        expectedProfit: Number(item.netProfit),
        daysTraded: item.daysTraded,
        priceWasAdjusted: item.priceWasAdjusted,
      });

      shipments[hub].totalCost += itemCost;
      shipments[hub].totalProfit += Number(item.netProfit);
      shipments[hub].itemCount += 1;
      totalCostAllShipments += itemCost;
    });

    // Generate multi-buy format for each shipment
    const shoppingLists = Object.values(shipments).map((shipment: any) => {
      const multiBuyText = shipment.items
        .map((item) => `${item.name}\t${item.quantity}`)
        .join('\n');

      const itemDetails = shipment.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        estimatedCostPerUnit: item.estimatedCostPerUnit,
        totalEstimatedCost: item.totalEstimatedCost,
        expectedProfit: item.expectedProfit,
        daysTraded: item.daysTraded,
        priceWasAdjusted: item.priceWasAdjusted,
        profitPerM3: Math.round(item.expectedProfit / (item.quantity * 0.01)), // Assuming 0.01m³ per item average
      }));

      return {
        destinationHub: shipment.hub,
        totalEstimatedCost: shipment.totalCost,
        totalExpectedProfit: shipment.totalProfit,
        itemCount: shipment.itemCount,
        multiBuyFormat: multiBuyText,
        multiBuyLines: shipment.items.map(
          (item) => `${item.name}\t${item.quantity}`,
        ), // Array of lines for easier handling
        itemDetails,
        instructions: [
          `1. Go to ${cycle.sourceHub.toUpperCase()} (${cycle.sourceHub === 'jita' ? 'Jita IV - Moon 4 - Caldari Navy Assembly Plant' : 'Trade Hub'})`,
          '2. Open Market window',
          '3. Click "Multi-buy" tab',
          '4. For proper line breaks, use: GET /cycle/{id}/shopping-list/{hub}/raw',
          '5. Copy the "copyPasteFormat" field from the raw endpoint',
          '6. Paste directly into EVE Online Multi-buy tab',
          `7. Verify total cost is around ${shipment.totalCost.toLocaleString()} ISK`,
          '8. Check individual prices for outliers before buying',
          `9. Transport to ${shipment.hub.toUpperCase()}`,
          `10. Expected profit: ${shipment.totalProfit.toLocaleString()} ISK`,
        ],
      };
    });

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        sourceHub: cycle.sourceHub,
        status: cycle.status,
      },
      summary: {
        totalShipments: shoppingLists.length,
        totalItems: cycle.cycleItems.length,
        totalEstimatedCost: totalCostAllShipments,
        totalExpectedProfit: shoppingLists.reduce(
          (sum, s) => sum + s.totalExpectedProfit,
          0,
        ),
      },
      shipments: shoppingLists,
    };
  }

  /**
   * Get cycle performance summary
   */
  async getCyclePerformance(cycleId: string) {
    const cycle = await this.prisma.tradingCycle.findUnique({
      where: { id: cycleId },
      include: {
        cycleItems: true,
        transactions: true,
      },
    });

    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    // Calculate performance metrics
    const buyTransactions = cycle.transactions.filter(
      (t) => t.transactionType === 'BUY',
    );
    const sellTransactions = cycle.transactions.filter(
      (t) => t.transactionType === 'SELL',
    );

    const totalInvested = buyTransactions.reduce(
      (sum, t) => sum + Number(t.totalValue),
      0,
    );
    const totalReceived = sellTransactions.reduce(
      (sum, t) => sum + Number(t.totalValue),
      0,
    );
    const actualProfit = totalReceived - totalInvested;

    const plannedProfit = Number(cycle.totalProfit);
    const profitVariance = actualProfit - plannedProfit;

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        status: cycle.status,
        plannedProfit,
        actualProfit,
        profitVariance,
        totalInvested,
        totalReceived,
        efficiency:
          plannedProfit > 0 ? (actualProfit / plannedProfit) * 100 : 0,
      },
      items: {
        total: cycle.cycleItems.length,
        planned: cycle.cycleItems.filter((i) => i.status === 'PLANNED').length,
        buying: cycle.cycleItems.filter((i) => i.status === 'BUYING').length,
        bought: cycle.cycleItems.filter((i) => i.status === 'BOUGHT').length,
        transporting: cycle.cycleItems.filter(
          (i) => i.status === 'TRANSPORTING',
        ).length,
        selling: cycle.cycleItems.filter((i) => i.status === 'SELLING').length,
        sold: cycle.cycleItems.filter((i) => i.status === 'SOLD').length,
        cancelled: cycle.cycleItems.filter((i) => i.status === 'CANCELLED')
          .length,
      },
      transactions: {
        total: cycle.transactions.length,
        buys: buyTransactions.length,
        sells: sellTransactions.length,
        totalInvested,
        totalReceived,
      },
    };
  }

  /**
   * Clear all cycles and related data (for testing purposes)
   */
  async clearAllCycles() {
    try {
      // Delete in correct order due to foreign key constraints
      await this.prisma.cycleTransaction.deleteMany({});
      await this.prisma.cycleItem.deleteMany({});
      await this.prisma.tradingCycle.deleteMany({});

      return {
        success: true,
        message: 'All cycles and related data cleared successfully',
        deletedTables: ['CycleTransaction', 'CycleItem', 'TradingCycle'],
      };
    } catch (error) {
      throw new Error(`Failed to clear cycles: ${error.message}`);
    }
  }
}
