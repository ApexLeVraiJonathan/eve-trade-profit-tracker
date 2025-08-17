import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EsiService } from './esi.service';
import {
  EsiStatusDto,
  EsiMarketPricesDto,
  EsiItemVolumeDto,
  EsiErrorDto,
} from './dto/esi.dto';

@ApiTags('esi')
@Controller('esi')
export class EsiController {
  private readonly logger = new Logger(EsiController.name);

  constructor(private readonly esiService: EsiService) {}

  @Get('status')
  getStatus(): EsiStatusDto {
    try {
      const stats = this.esiService.getStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get ESI status:', errorMessage);

      return {
        success: false,
        data: {
          connected: false,
          rateLimitRemaining: 0,
          rateLimitReset: 0,
          totalCalls: 0,
          errors: 1,
        },
      };
    }
  }

  @Get('market-prices/:regionId')
  async getMarketPrices(
    @Param('regionId') regionId: string,
  ): Promise<EsiMarketPricesDto | EsiErrorDto> {
    try {
      const regionIdNum = parseInt(regionId);

      if (isNaN(regionIdNum)) {
        return {
          success: false,
          error: 'Invalid region ID',
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.log(`Fetching market prices for region ${regionIdNum}`);

      const response = await this.esiService.getMarketOrders(regionIdNum);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || 'Failed to fetch market orders',
          timestamp: new Date().toISOString(),
        };
      }

      // Get region name
      // Note: In a real implementation, you might want to cache region names
      const regionName = `Region ${regionIdNum}`;

      return {
        success: true,
        data: {
          regionId: regionIdNum,
          regionName,
          orders: response.data.map((order) => ({
            itemTypeId: order.type_id,
            itemTypeName: `Type ${order.type_id}`, // Could be enriched with actual names
            locationId: order.location_id.toString(),
            orderType: order.is_buy_order ? 'buy' : 'sell',
            price: order.price.toString(),
            volume: order.volume_remain,
            minVolume: order.min_volume,
            duration: order.duration,
            issued: order.issued,
            orderRange: order.range,
          })),
          fetchedAt: new Date().toISOString(),
          totalOrders: response.data.length,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to fetch market prices for region ${regionId}:`,
        errorMessage,
      );

      return {
        success: false,
        error: 'Internal server error',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('fetch-item-volumes')
  async fetchItemVolumes(): Promise<EsiItemVolumeDto | EsiErrorDto> {
    try {
      this.logger.log('Starting item volume update...');

      const result = await this.esiService.updateItemVolumes();

      return {
        success: true,
        data: [], // Could be enriched with detailed item info
        stats: {
          totalProcessed: result.updated + result.errors,
          updated: result.updated,
          errors: result.errors,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to update item volumes:', errorMessage);

      return {
        success: false,
        error: 'Failed to update item volumes',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('refresh-prices')
  async refreshMarketPrices(): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      this.logger.log(
        'Manually refreshing market prices for tracked stations...',
      );

      const prices =
        await this.esiService.fetchMarketPricesForTrackedStations();

      return {
        success: true,
        message: `Successfully fetched ${prices.length} market prices`,
        data: {
          totalPrices: prices.length,
          refreshedAt: new Date().toISOString(),
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

  @Post('configure-auth-rate-limit')
  configureAuthRateLimit(): {
    success: boolean;
    message: string;
    data?: any;
  } {
    try {
      this.esiService.configureAuthenticatedRateLimit();
      const stats = this.esiService.getStats();

      return {
        success: true,
        message: 'ESI rate limiting configured for authenticated access',
        data: {
          estimatedReqPerSec: stats.estimatedReqPerSec,
          requestDelay: stats.requestDelay,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to configure auth rate limit:', errorMessage);

      return {
        success: false,
        message: 'Failed to configure auth rate limit',
      };
    }
  }
}
