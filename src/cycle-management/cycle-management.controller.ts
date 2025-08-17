import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CycleManagementService } from './cycle-management.service';
import { ArbitrageService } from '../arbitrage/arbitrage.service';
import { CreateCycleDto, CycleFiltersDto } from './dto/cycle.dto';
import { CycleOpportunitiesResponse } from './interfaces/cycle.interface';

@ApiTags('cycle')
@Controller('cycle')
export class CycleManagementController {
  constructor(
    private readonly cycleManagementService: CycleManagementService,
    private readonly arbitrageService: ArbitrageService,
  ) {}

  /**
   * Create a new trading cycle and store it in the database
   */
  @Post('create')
  async createCycle(@Body() createCycleDto: CreateCycleDto) {
    const {
      sourceHub,
      totalCapital,
      allocations,
      cargoCapacity,
      minProfitMargin,
      minLiquidity,
      name,
      startDate,
      endDate,
    } = createCycleDto;

    return await this.cycleManagementService.createCycle({
      sourceHub,
      totalCapital,
      hubAllocations: allocations,
      cargoCapacity,
      minProfitMargin,
      minLiquidity,
      name,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * Get all cycles
   */
  @Get()
  async getCycles() {
    return await this.cycleManagementService.getCycles();
  }

  /**
   * Get detailed cycle information by ID
   */
  @Get(':cycleId')
  async getCycleById(@Param('cycleId') cycleId: string) {
    return await this.cycleManagementService.getCycleById(cycleId);
  }

  /**
   * Update cycle status
   */
  @Patch(':cycleId/status')
  async updateCycleStatus(
    @Param('cycleId') cycleId: string,
    @Body('status') status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
  ) {
    return await this.cycleManagementService.updateCycleStatus(cycleId, status);
  }

  /**
   * Get cycle opportunities with default allocations (50% Amarr, 30% Dodixie, 10% Hek, 10% Rens)
   */
  @Get('opportunities')
  async getCycleOpportunities(
    @Query('sourceHub') sourceHub: string = 'jita',
    @Query('totalCapital') totalCapital: number = 1000000000, // 1B ISK default
    @Query('minMarginPercent') minMarginPercent?: number,
    @Query('minLiquidity') minLiquidity?: number,
    @Query('maxItemsPerHub') maxItemsPerHub?: number,
  ): Promise<CycleOpportunitiesResponse> {
    const filters: CycleFiltersDto = {};
    if (minMarginPercent !== undefined)
      filters.minMarginPercent = minMarginPercent;
    if (minLiquidity !== undefined) filters.minLiquidity = minLiquidity;
    if (maxItemsPerHub !== undefined) filters.maxItemsPerHub = maxItemsPerHub;

    return this.cycleManagementService.getCycleOpportunities(
      sourceHub,
      totalCapital,
      undefined, // Use default allocations
      filters,
    );
  }

  /**
   * Get cycle opportunities for a specific hub allocation
   */
  @Get('hub-opportunities')
  async getHubCycleOpportunities(
    @Query('sourceHub') sourceHub: string = 'jita',
    @Query('destinationHub') destinationHub: string,
    @Query('totalCapital') totalCapital: number = 1000000000,
    @Query('allocation') allocation: number = 1.0, // 100% to this hub
    @Query('minMarginPercent') minMarginPercent?: number,
    @Query('minLiquidity') minLiquidity?: number,
    @Query('maxItemsPerHub') maxItemsPerHub?: number,
  ): Promise<CycleOpportunitiesResponse> {
    const allocations = { [destinationHub]: allocation };
    const filters: CycleFiltersDto = {};
    if (minMarginPercent !== undefined)
      filters.minMarginPercent = minMarginPercent;
    if (minLiquidity !== undefined) filters.minLiquidity = minLiquidity;
    if (maxItemsPerHub !== undefined) filters.maxItemsPerHub = maxItemsPerHub;

    return this.cycleManagementService.getCycleOpportunities(
      sourceHub,
      totalCapital,
      allocations,
      filters,
    );
  }

  /**
   * 🏁 ALGORITHM COMPETITION: Compare packing algorithms
   */
  @Get('algorithm-competition')
  async compareAlgorithms(
    @Query('sourceHub') sourceHub: string = 'jita',
    @Query('destinationHub') destinationHub: string = 'amarr',
    @Query('budget') budgetStr: string = '500000000',
  ) {
    const budget = parseInt(budgetStr);

    // Transport costs per 60km³ shipment (based on jumps)
    const transportCosts: Record<string, number> = {
      amarr: 46 * 1500000, // 46 jumps × 1.5M ISK
      dodixie: 16 * 1500000, // 16 jumps × 1.5M ISK
      hek: 20 * 1500000, // 20 jumps × 1.5M ISK
      rens: 26 * 1500000, // 26 jumps × 1.5M ISK
    };

    // Get arbitrage opportunities for this route
    const opportunities =
      await this.arbitrageService.findMultiHubArbitrageOpportunities({
        sourceHub,
        destinationHubs: [destinationHub],
        filters: {
          minMarginPercent: 15,
          sortBy: 'profitPerM3',
          sortOrder: 'desc',
        },
      });

    const hubOpportunities = opportunities; // All opportunities for the destination hub
    const transportCost = transportCosts[destinationHub.toLowerCase()] || 0;

    // Run the algorithm competition
    const competition =
      await this.cycleManagementService.comparePackingAlgorithms(
        hubOpportunities,
        budget,
        transportCost,
      );

    return {
      success: true,
      route: `${sourceHub} → ${destinationHub}`,
      budget: budget.toLocaleString(),
      transportCost: transportCost.toLocaleString(),
      availableOpportunities: hubOpportunities.length,
      competition,
    };
  }

  /**
   * Get transport cost information for all hubs
   */
  @Get('transport-costs')
  getTransportCosts() {
    return {
      amarr: {
        jumps: 46,
        costPerShipment: 46 * 1500000, // 69M ISK
        description: 'Jita → Amarr: 46 jumps',
      },
      dodixie: {
        jumps: 16,
        costPerShipment: 16 * 1500000, // 24M ISK
        description: 'Jita → Dodixie: 16 jumps',
      },
      hek: {
        jumps: 20,
        costPerShipment: 20 * 1500000, // 30M ISK
        description: 'Jita → Hek: 20 jumps',
      },
      rens: {
        jumps: 26,
        costPerShipment: 26 * 1500000, // 39M ISK
        description: 'Jita → Rens: 26 jumps',
      },
      note: 'Costs based on 1.5M ISK per jump for 60km³ shipments',
    };
  }

  /**
   * Get default allocation strategy
   */
  @Get('default-allocations')
  getDefaultAllocations() {
    return {
      amarr: 0.5, // 50%
      dodixie: 0.3, // 30%
      hek: 0.1, // 10%
      rens: 0.1, // 10%
      description: 'Based on historical trade volume and transport efficiency',
    };
  }

  /**
   * Record a buy/sell transaction
   */
  @Post(':cycleId/transactions')
  async recordTransaction(
    @Param('cycleId') cycleId: string,
    @Body()
    transaction: {
      cycleItemId?: string;
      transactionType: 'BUY' | 'SELL';
      itemTypeId: number;
      quantity: number;
      pricePerUnit: number;
      locationId: string; // Will be converted to BigInt
      executedAt?: string; // ISO date string
      estimatedPrice?: number;
    },
  ) {
    return await this.cycleManagementService.recordTransaction({
      cycleId,
      cycleItemId: transaction.cycleItemId,
      transactionType: transaction.transactionType,
      itemTypeId: transaction.itemTypeId,
      quantity: transaction.quantity,
      pricePerUnit: transaction.pricePerUnit,
      locationId: BigInt(transaction.locationId),
      executedAt: transaction.executedAt
        ? new Date(transaction.executedAt)
        : undefined,
      estimatedPrice: transaction.estimatedPrice,
    });
  }

  /**
   * Get transactions for a cycle
   */
  @Get(':cycleId/transactions')
  async getCycleTransactions(@Param('cycleId') cycleId: string) {
    return await this.cycleManagementService.getCycleTransactions(cycleId);
  }

  /**
   * Update cycle item status
   */
  @Patch(':cycleId/items/:itemId/status')
  async updateCycleItemStatus(
    // cycleId is part of the route but not used here; keep for route shape
    @Param('cycleId') _cycleId: string,
    @Param('itemId') itemId: string,
    @Body('status')
    status:
      | 'PLANNED'
      | 'BUYING'
      | 'BOUGHT'
      | 'TRANSPORTING'
      | 'SELLING'
      | 'SOLD'
      | 'CANCELLED',
  ) {
    return await this.cycleManagementService.updateCycleItemStatus(
      itemId,
      status,
    );
  }

  /**
   * Get cycle performance summary
   */
  @Get(':cycleId/performance')
  async getCyclePerformance(@Param('cycleId') cycleId: string) {
    return await this.cycleManagementService.getCyclePerformance(cycleId);
  }

  /**
   * Get shopping list in multi-buy format for EVE Online
   */
  @Get(':cycleId/shopping-list')
  async getCycleShoppingList(@Param('cycleId') cycleId: string) {
    return await this.cycleManagementService.getCycleShoppingList(cycleId);
  }

  /**
   * Get raw multi-buy text for a specific shipment (plain text response)
   */
  @Get(':cycleId/shopping-list/:hub/raw')
  async getRawShoppingList(
    @Param('cycleId') cycleId: string,
    @Param('hub') hub: string,
  ) {
    const shoppingList =
      await this.cycleManagementService.getCycleShoppingList(cycleId);
    const shipment = shoppingList.shipments.find(
      (s) => s.destinationHub === hub.toLowerCase(),
    );

    if (!shipment) {
      throw new Error(`No shipment found for hub: ${hub}`);
    }

    // Return raw text with actual line breaks
    return {
      hub: shipment.destinationHub,
      totalCost: shipment.totalEstimatedCost,
      totalProfit: shipment.totalExpectedProfit,
      itemCount: shipment.itemCount,
      rawText: shipment.multiBuyFormat,
      copyPasteFormat: shipment.multiBuyLines.join('\n'), // Proper line breaks
      instructions: [
        'Copy the text from "copyPasteFormat" field',
        'Paste directly into EVE Online Multi-buy tab',
        `Expected total cost: ${shipment.totalEstimatedCost.toLocaleString()} ISK`,
      ],
    };
  }

  /**
   * Clear all cycles and related data (for testing purposes)
   */
  @Delete('clear-all')
  async clearAllCycles() {
    return await this.cycleManagementService.clearAllCycles();
  }
}
