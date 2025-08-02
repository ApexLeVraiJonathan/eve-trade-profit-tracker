import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CycleManagementService } from './cycle-management.service';
import { CreateCycleDto, CycleFiltersDto } from './dto/cycle.dto';
import { CycleOpportunitiesResponse } from './interfaces/cycle.interface';

@Controller('cycle')
export class CycleManagementController {
  constructor(
    private readonly cycleManagementService: CycleManagementService,
  ) {}

  /**
   * Create a new cycle with custom allocations and filters
   */
  @Post('create')
  async createCycle(
    @Body() createCycleDto: CreateCycleDto,
  ): Promise<CycleOpportunitiesResponse> {
    const { sourceHub, totalCapital, allocations, filters } = createCycleDto;

    return this.cycleManagementService.getCycleOpportunities(
      sourceHub,
      totalCapital,
      allocations,
      filters,
    );
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
}
