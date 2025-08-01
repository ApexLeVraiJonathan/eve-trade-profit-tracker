import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import {
  EsiMarketOrder,
  EsiTypeInfo,
  EsiApiResponse,
  EsiRateLimitInfo,
  EsiMarketPrice,
} from './interfaces/esi.interface';

@Injectable()
export class EsiService {
  private readonly logger = new Logger(EsiService.name);
  private readonly baseUrl = 'https://esi.evetech.net/latest';
  private readonly userAgent = 'EVE-Trade-Profit-Tracker/1.0.0';

  // ESI rate limiting - 100 req/sec public, 400+ with auth
  private lastRequestTime = 0;
  private requestDelay = 15; // 15ms = ~67 req/sec (conservative)
  private currentRateLimit = {
    remaining: 100,
    reset: Date.now() + 60000,
    limit: 100,
  };

  // Statistics
  private totalCalls = 0;
  private errors = 0;
  private lastSuccessfulCall?: Date;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Smart rate limiting based on ESI headers
   */
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();

    // Check if we're close to hitting the rate limit
    if (this.currentRateLimit.remaining <= 5) {
      const timeUntilReset = this.currentRateLimit.reset - now;
      if (timeUntilReset > 0 && timeUntilReset < 60000) {
        this.logger.warn(
          `Rate limit nearly exhausted (${this.currentRateLimit.remaining} remaining), waiting ${timeUntilReset}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, timeUntilReset));
        return;
      }
    }

    // Conservative delay to prevent hitting rate limits
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      const delay = this.requestDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Make a request to ESI API with rate limiting
   */
  private async makeRequest<T>(url: string): Promise<EsiApiResponse<T>> {
    await this.rateLimitDelay();
    this.totalCalls++;

    try {
      const response = await firstValueFrom(
        this.httpService.get<T>(url, {
          headers: {
            'User-Agent': this.userAgent,
          },
        }),
      );

      this.lastSuccessfulCall = new Date();

      // Update rate limit info from response headers
      const rateLimitInfo = this.extractRateLimitInfo(response.headers);
      if (rateLimitInfo) {
        this.currentRateLimit = rateLimitInfo;
        this.logger.debug(
          `Rate limit updated: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} remaining`,
        );
      }

      return {
        success: true,
        data: response.data,
        rateLimit: rateLimitInfo,
      };
    } catch (error: unknown) {
      this.errors++;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`ESI API request failed: ${url}`, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Extract rate limit information from response headers
   */
  private extractRateLimitInfo(headers: any): EsiRateLimitInfo | undefined {
    // Safely extract rate limit headers
    const remaining = (headers as Record<string, string | undefined>)[
      'x-esi-request-limit-remain'
    ];
    const reset = (headers as Record<string, string | undefined>)[
      'x-esi-request-limit-reset'
    ];
    const limit = (headers as Record<string, string | undefined>)[
      'x-esi-request-limit-per-second'
    ];

    if (remaining && reset && limit) {
      return {
        remaining: parseInt(remaining),
        reset: Date.now() + parseInt(reset) * 1000, // Convert seconds to ms timestamp
        limit: parseInt(limit),
      };
    }

    return undefined;
  }

  /**
   * Get market orders for a specific region
   */
  async getMarketOrders(
    regionId: number,
    typeId?: number,
  ): Promise<EsiApiResponse<EsiMarketOrder[]>> {
    let url = `${this.baseUrl}/markets/${regionId}/orders/`;

    if (typeId) {
      url += `?type_id=${typeId}`;
    }

    this.logger.debug(
      `Fetching market orders for region ${regionId}${typeId ? `, type ${typeId}` : ''}`,
    );
    return this.makeRequest<EsiMarketOrder[]>(url);
  }

  /**
   * Get type information from universe endpoint
   */
  async getTypeInfo(typeId: number): Promise<EsiApiResponse<EsiTypeInfo>> {
    const url = `${this.baseUrl}/universe/types/${typeId}/`;

    this.logger.debug(`Fetching type info for ${typeId}`);
    return this.makeRequest<EsiTypeInfo>(url);
  }

  /**
   * Update item volume data for tracked items
   */
  async updateItemVolumes(): Promise<{ updated: number; errors: number }> {
    this.logger.log('Starting item volume update for tracked items...');

    // Get all item types that appear in tracked stations' market data
    const trackedItemTypes = await this.prisma.itemType.findMany({
      where: {
        marketTrades: {
          some: {
            station: {
              trackedStations: {
                some: {
                  isActive: true,
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        volume: true,
      },
    });

    this.logger.log(`Found ${trackedItemTypes.length} item types to update`);

    let updated = 0;
    let errors = 0;

    for (const itemType of trackedItemTypes) {
      // Skip if we already have volume data
      if (itemType.volume !== null) {
        continue;
      }

      const typeInfo = await this.getTypeInfo(itemType.id);

      if (typeInfo.success && typeInfo.data) {
        try {
          await this.prisma.itemType.update({
            where: { id: itemType.id },
            data: { volume: typeInfo.data.volume },
          });

          updated++;
          this.logger.debug(
            `Updated volume for ${itemType.name}: ${typeInfo.data.volume} m³`,
          );
        } catch (error: unknown) {
          errors++;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Failed to update volume for ${itemType.name}:`,
            errorMessage,
          );
        }
      } else {
        errors++;
        this.logger.warn(`Failed to fetch type info for ${itemType.name}`);
      }
    }

    this.logger.log(
      `Item volume update complete: ${updated} updated, ${errors} errors`,
    );
    return { updated, errors };
  }

  /**
   * Get current market prices for tracked stations
   */
  async fetchMarketPricesForTrackedStations(): Promise<EsiMarketPrice[]> {
    this.logger.log('Fetching market prices for tracked stations...');

    // Get tracked stations with their regions
    const trackedStations = await this.prisma.trackedStation.findMany({
      where: { isActive: true },
      include: {
        station: {
          include: {
            solarSystem: {
              include: {
                region: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Found ${trackedStations.length} active tracked stations`);

    const allPrices: EsiMarketPrice[] = [];

    // Group stations by region to minimize API calls
    const stationsByRegion = trackedStations.reduce(
      (acc, station) => {
        const regionId = station.station?.solarSystem?.region?.id;
        if (regionId) {
          if (!acc[regionId]) {
            acc[regionId] = [];
          }
          acc[regionId].push(station);
        }
        return acc;
      },
      {} as Record<number, typeof trackedStations>,
    );

    for (const [regionId, stations] of Object.entries(stationsByRegion)) {
      const regionIdNum = parseInt(regionId);

      this.logger.debug(`Fetching market orders for region ${regionIdNum}`);
      const ordersResponse = await this.getMarketOrders(regionIdNum);

      if (ordersResponse.success && ordersResponse.data) {
        // Filter orders to only those in our tracked stations
        const trackedLocationIds = new Set(stations.map((s) => s.stationId));

        const relevantOrders = ordersResponse.data.filter((order) =>
          trackedLocationIds.has(BigInt(order.location_id)),
        );

        this.logger.debug(
          `Found ${relevantOrders.length} relevant orders out of ${ordersResponse.data.length} total orders`,
        );

        // Convert to our format
        for (const order of relevantOrders) {
          // Get item type name
          const itemType = await this.prisma.itemType.findUnique({
            where: { id: order.type_id },
            select: { name: true },
          });

          allPrices.push({
            itemTypeId: order.type_id,
            itemTypeName: itemType?.name || `Type ${order.type_id}`,
            regionId: regionIdNum,
            locationId: order.location_id,
            orderType: order.is_buy_order ? 'buy' : 'sell',
            price: order.price,
            volume: order.volume_remain,
            minVolume: order.min_volume,
            duration: order.duration,
            issued: new Date(order.issued),
            orderRange: order.range,
          });
        }
      } else {
        this.logger.warn(
          `Failed to fetch market orders for region ${regionIdNum}`,
        );
      }
    }

    this.logger.log(`Fetched ${allPrices.length} market prices total`);
    return allPrices;
  }

  /**
   * Configure rate limiting for authenticated ESI access
   * Call this if you have an authenticated ESI application
   */
  configureAuthenticatedRateLimit() {
    // Authenticated ESI typically allows 400-500 req/sec
    this.requestDelay = 3; // 3ms = ~333 req/sec (conservative for auth)
    this.logger.log(
      'ESI rate limiting configured for authenticated access (333 req/sec)',
    );
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      connected: true,
      rateLimitRemaining: this.currentRateLimit.remaining,
      rateLimitReset: this.currentRateLimit.reset,
      rateLimitLimit: this.currentRateLimit.limit,
      lastSuccessfulCall: this.lastSuccessfulCall?.toISOString(),
      totalCalls: this.totalCalls,
      errors: this.errors,
      requestDelay: this.requestDelay,
      estimatedReqPerSec: Math.round(1000 / this.requestDelay),
    };
  }
}
