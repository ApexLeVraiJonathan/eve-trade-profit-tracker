import { Injectable, Logger } from '@nestjs/common';
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

  constructor(private readonly arbitrageService: ArbitrageService) {}

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
    const MAX_EXECUTION_TIME = 5000; // 5 second timeout

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
    const results = Object.values(algorithms);
    const maxProfit = Math.max(...results.map((r) => r.totalProfit));
    const maxUtilization = Math.max(...results.map((r) => r.cargoUtilization));
    const minTime = Math.min(...results.map((r) => r.executionTimeMs));

    return {
      maxProfit,
      maxUtilization,
      minTime,
      profitDifference:
        maxProfit - Math.min(...results.map((r) => r.totalProfit)),
      speedDifference:
        Math.max(...results.map((r) => r.executionTimeMs)) - minTime,
      recommendation: this.getRecommendation(algorithms),
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
}
