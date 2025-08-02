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

interface QueuedRequest<T = unknown> {
  url: string;
  resolve: (value: EsiApiResponse<T>) => void;
  reject: (error: EsiApiResponse<never>) => void;
}

@Injectable()
export class EsiService {
  private readonly logger = new Logger(EsiService.name);
  private readonly baseUrl = 'https://esi.evetech.net/latest';

  // Configuration from environment variables
  private readonly maxRequestsPerSecond = parseInt(
    process.env.ESI_MAX_REQUESTS_PER_SECOND || '100',
  );
  private readonly userAgent =
    process.env.ESI_USER_AGENT || 'EVE-Trade-Profit-Tracker/1.0.0';

  // Centralized rate limiting and queue management
  private requestQueue: QueuedRequest<any>[] = [];
  private lastRequestTime = 0;
  private requestDelay: number;

  // ESI rate limit tracking
  private currentRateLimit = {
    remaining: this.maxRequestsPerSecond,
    reset: Date.now() + 60000,
    limit: this.maxRequestsPerSecond,
  };

  // Statistics
  private totalCalls = 0;
  private errors = 0;
  private lastSuccessfulCall?: Date;
  private isProcessingQueue = false;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    // Calculate delay based on desired requests per second
    this.requestDelay = Math.ceil(1000 / this.maxRequestsPerSecond);

    this.logger.log(
      `ESI Service initialized: ${this.maxRequestsPerSecond} req/sec, ${this.requestDelay}ms delay`,
    );

    // Start processing queue (background process)
    void this.processQueue();
  }

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
   * Process the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (true) {
      // Wait if queue is empty
      if (this.requestQueue.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        continue;
      }

      // Get next request from queue
      const request = this.requestQueue.shift();
      if (!request) continue;

      // Process request (fire and forget for concurrency)
      void this.processRequest(request);

      // Rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, this.requestDelay));
    }
  }

  /**
   * Process a single request with error handling
   */
  private async processRequest(request: QueuedRequest<any>): Promise<void> {
    this.totalCalls++;

    try {
      const response = await firstValueFrom(
        this.httpService.get(request.url, {
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

        // Log warnings if rate limit is getting low
        if (rateLimitInfo.remaining < 10) {
          this.logger.warn(
            `ESI rate limit low: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} remaining`,
          );
        }
      }

      request.resolve({
        success: true,
        data: response.data as unknown,
        rateLimit: rateLimitInfo,
      });
    } catch (error: unknown) {
      this.errors++;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`ESI API request failed: ${request.url}`, errorMessage);

      request.reject({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * Queue a request for processing with rate limiting
   */
  private queueRequest<T>(url: string): Promise<EsiApiResponse<T>> {
    return new Promise<EsiApiResponse<T>>((resolve, reject) => {
      this.requestQueue.push({
        url,
        resolve: resolve as (value: EsiApiResponse<any>) => void,
        reject: reject as (error: EsiApiResponse<never>) => void,
      });
    });
  }

  /**
   * Make a request to ESI API with centralized rate limiting and queuing
   */
  private async makeRequest<T>(url: string): Promise<EsiApiResponse<T>> {
    return this.queueRequest<T>(url);
  }

  /**
   * Batch execute multiple market order requests in parallel with rate limiting
   */
  async batchGetMarketOrders(
    requests: Array<{ regionId: number; itemTypeId: number }>,
  ): Promise<
    Array<{
      regionId: number;
      itemTypeId: number;
      success: boolean;
      data?: any;
      orders?: EsiMarketOrder[];
      error?: string;
    }>
  > {
    this.logger.log(
      `Executing batch of ${requests.length} market order requests`,
    );

    // Create promises for all requests
    const promises = requests.map(async ({ regionId, itemTypeId }) => {
      try {
        const response = await this.getMarketOrders(regionId, itemTypeId);
        return {
          regionId,
          itemTypeId,
          success: response.success,
          data: response.data,
          orders: response.data,
          error: response.error,
        };
      } catch (error) {
        return {
          regionId,
          itemTypeId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Wait for all requests to complete (queue handles rate limiting)
    const results = await Promise.allSettled(promises);

    // Convert PromiseSettledResult to our format
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : 'Promise rejected';
        return {
          regionId: requests[index].regionId,
          itemTypeId: requests[index].itemTypeId,
          success: false,
          error: errorMessage,
        };
      }
    });
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
   * Get market orders for a specific region (handles pagination in parallel)
   */
  async getMarketOrders(
    regionId: number,
    typeId?: number,
  ): Promise<EsiApiResponse<EsiMarketOrder[]>> {
    const baseUrl = `${this.baseUrl}/markets/${regionId}/orders/`;

    // Build base URL with parameters
    let firstPageUrl = baseUrl;
    const params: string[] = [];

    if (typeId) {
      params.push(`type_id=${typeId}`);
    }
    params.push('page=1');

    if (params.length > 0) {
      firstPageUrl += `?${params.join('&')}`;
    }

    // Removed noisy debug log - too many individual requests

    // Get first page to determine total page count
    const firstResponse =
      await this.makeRequest<EsiMarketOrder[]>(firstPageUrl);

    if (!firstResponse.success || !firstResponse.data) {
      return firstResponse;
    }

    // Extract total pages from response (check both header and data length)
    const totalPages = this.extractTotalPages(
      firstResponse.rateLimit,
      firstResponse.data.length,
    );

    if (totalPages <= 1) {
      // Only one page, return first page data
      return firstResponse;
    }

    this.logger.debug(
      `Item has ${totalPages} pages, fetching remaining ${totalPages - 1} pages in parallel`,
    );

    // Create parallel requests for remaining pages (2 to totalPages)
    const pagePromises: Promise<EsiApiResponse<EsiMarketOrder[]>>[] = [];

    for (let page = 2; page <= totalPages; page++) {
      const pageParams = typeId
        ? [`type_id=${typeId}`, `page=${page}`]
        : [`page=${page}`];
      const pageUrl = `${baseUrl}?${pageParams.join('&')}`;

      pagePromises.push(this.makeRequest<EsiMarketOrder[]>(pageUrl));
    }

    // Wait for all pages to complete
    const pageResults = await Promise.allSettled(pagePromises);

    // Combine all orders
    const allOrders: EsiMarketOrder[] = [...firstResponse.data];
    let errors = 0;

    pageResults.forEach((result, index) => {
      if (
        result.status === 'fulfilled' &&
        result.value.success &&
        result.value.data
      ) {
        allOrders.push(...result.value.data);
      } else {
        errors++;
        this.logger.warn(
          `Failed to fetch page ${index + 2} for region ${regionId}, type ${typeId}`,
        );
      }
    });

    if (errors > 0) {
      this.logger.warn(
        `${errors} pages failed for region ${regionId}, type ${typeId}`,
      );
    }

    this.logger.debug(
      `Fetched ${allOrders.length} total orders for region ${regionId} across ${totalPages} pages`,
    );

    return {
      success: true,
      data: allOrders,
    };
  }

  /**
   * Extract total page count from ESI response
   */
  private extractTotalPages(rateLimit: any, dataLength: number): number {
    // For now, use a heuristic based on data length
    // If we got a full page (1000 orders), there are likely more pages
    if (dataLength === 1000) {
      // Conservative estimate: assume 2-3 pages for most items
      // Popular items like Tritanium might have more, but this reduces
      // the number of unnecessary requests for most items
      return 3;
    }

    return 1; // Only one page
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

    // Filter items that need volume updates
    const itemsToUpdate = trackedItemTypes.filter(
      (item) => item.volume === null,
    );
    this.logger.log(`${itemsToUpdate.length} items need volume updates`);

    if (itemsToUpdate.length === 0) {
      this.logger.log('All items already have volume data');
      return { updated: 0, errors: 0 };
    }

    // Create all promises and let ESI rate limiter handle queueing (much simpler!)
    this.logger.log(
      `⏱️  Fetching volume data for ${itemsToUpdate.length} items (ESI rate limited)`,
    );

    const typeInfoPromises = itemsToUpdate.map(async (itemType) => {
      const typeInfo = await this.getTypeInfo(itemType.id);
      return { itemType, typeInfo };
    });

    // Let ESI rate limiter handle all requests (much simpler than batching!)
    const results = await Promise.allSettled(typeInfoPromises);

    // Prepare database updates
    const dbUpdates: Array<{
      where: { id: number };
      data: { volume: number };
    }> = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { itemType, typeInfo } = result.value;

        if (typeInfo.success && typeInfo.data) {
          dbUpdates.push({
            where: { id: itemType.id },
            data: { volume: typeInfo.data.volume },
          });
        } else {
          errors++;
          this.logger.warn(`Failed to fetch type info for ${itemType.name}`);
        }
      } else {
        errors++;
        this.logger.error(`Promise failed: ${result.reason}`);
      }
    }

    // Execute database updates concurrently
    if (dbUpdates.length > 0) {
      await Promise.allSettled(
        dbUpdates.map((update) => this.prisma.itemType.update(update)),
      );
      updated = dbUpdates.length;
      this.logger.log(`✅ Updated ${updated} items`);
    }

    this.logger.log(
      `Item volume update complete: ${updated} updated, ${errors} errors`,
    );
    return { updated, errors };
  }

  /**
   * Get current market prices for tracked stations (optimized for specific items)
   */
  async fetchMarketPricesForTrackedStations(
    liquidItemIds: number[] = [],
  ): Promise<EsiMarketPrice[]> {
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

    // If we have specific items to look for, use targeted fetching
    if (liquidItemIds.length > 0) {
      this.logger.log(
        `Using targeted fetching for ${liquidItemIds.length} liquid items`,
      );

      // Pre-fetch all item type names to avoid N+1 database queries
      const itemTypes = await this.prisma.itemType.findMany({
        where: { id: { in: liquidItemIds } },
        select: { id: true, name: true },
      });
      const itemTypeMap = new Map(
        itemTypes.map((item) => [item.id, item.name]),
      );

      for (const [regionId, stations] of Object.entries(stationsByRegion)) {
        const regionIdNum = parseInt(regionId);
        const trackedLocationIds = new Set(stations.map((s) => s.stationId));

        // Fetch orders for each liquid item type in this region
        for (const itemTypeId of liquidItemIds) {
          const ordersResponse = await this.getMarketOrders(
            regionIdNum,
            itemTypeId,
          );

          if (ordersResponse.success && ordersResponse.data) {
            // Filter orders to only those in our tracked stations
            const relevantOrders = ordersResponse.data.filter((order) =>
              trackedLocationIds.has(BigInt(order.location_id)),
            );

            // Convert to our format
            for (const order of relevantOrders) {
              // Get item type name from pre-fetched map
              const itemTypeName = itemTypeMap.get(order.type_id);

              // DEBUG: Log Photonic orders being processed
              if (itemTypeName?.includes('Photonic Upgraded Co-Processor')) {
                this.logger.log(
                  `🔍 ESI ORDER: ${itemTypeName} - ${order.is_buy_order ? 'BUY' : 'SELL'} ${order.price} ISK (${order.volume_remain} units) at location ${order.location_id}`,
                );
              }

              allPrices.push({
                itemTypeId: order.type_id,
                itemTypeName: itemTypeName || `Type ${order.type_id}`,
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
          }
        }
      }
    } else {
      // Fallback to old method if no liquid items provided
      this.logger.log('No liquid items provided, fetching all orders (slow)');

      // First, collect all orders to determine unique item types
      const allOrders: Array<{ order: EsiMarketOrder; regionIdNum: number }> =
        [];

      for (const [regionId, stations] of Object.entries(stationsByRegion)) {
        const regionIdNum = parseInt(regionId);
        const ordersResponse = await this.getMarketOrders(regionIdNum);

        if (ordersResponse.success && ordersResponse.data) {
          // Filter orders to only those in our tracked stations
          const trackedLocationIds = new Set(stations.map((s) => s.stationId));
          const relevantOrders = ordersResponse.data.filter((order) =>
            trackedLocationIds.has(BigInt(order.location_id)),
          );

          // Store orders with their region info
          relevantOrders.forEach((order) => {
            allOrders.push({ order, regionIdNum });
          });
        } else {
          this.logger.warn(
            `Failed to fetch market orders for region ${regionIdNum}`,
          );
        }
      }

      // Pre-fetch all item type names for unique item types found
      const uniqueItemTypeIds = [
        ...new Set(allOrders.map(({ order }) => order.type_id)),
      ];
      const itemTypes = await this.prisma.itemType.findMany({
        where: { id: { in: uniqueItemTypeIds } },
        select: { id: true, name: true },
      });
      const itemTypeMap = new Map(
        itemTypes.map((item) => [item.id, item.name]),
      );

      // Now process all orders with pre-fetched item names
      for (const { order, regionIdNum } of allOrders) {
        const itemTypeName = itemTypeMap.get(order.type_id);

        // DEBUG: Log Photonic orders being processed
        if (itemTypeName?.includes('Photonic Upgraded Co-Processor')) {
          this.logger.log(
            `🔍 ESI ORDER: ${itemTypeName} - ${order.is_buy_order ? 'BUY' : 'SELL'} ${order.price} ISK (${order.volume_remain} units) at location ${order.location_id}`,
          );
        }

        allPrices.push({
          itemTypeId: order.type_id,
          itemTypeName: itemTypeName || `Type ${order.type_id}`,
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
    }

    this.logger.log(`Fetched ${allPrices.length} market prices total`);
    return allPrices;
  }

  /**
   * Get market prices for a specific route (source → destination stations)
   * Much more efficient than fetching all regions
   */
  async fetchMarketPricesForRoute(
    sourceStationId: bigint,
    destStationId: bigint,
    liquidItemIds: number[],
  ): Promise<EsiMarketPrice[]> {
    this.logger.log(
      `Fetching market prices for route: ${sourceStationId} → ${destStationId}`,
    );

    const allPrices: EsiMarketPrice[] = [];

    // Get station info to determine regions
    const [sourceStation, destStation] = await Promise.all([
      this.prisma.station.findUnique({
        where: { id: sourceStationId },
        include: { solarSystem: { include: { region: true } } },
      }),
      this.prisma.station.findUnique({
        where: { id: destStationId },
        include: { solarSystem: { include: { region: true } } },
      }),
    ]);

    if (!sourceStation || !destStation) {
      this.logger.error('Source or destination station not found');
      return allPrices;
    }

    const sourceRegionId = sourceStation.solarSystem.region.id;
    const destRegionId = destStation.solarSystem.region.id;

    this.logger.log(
      `Route: ${sourceStation.name} (region ${sourceRegionId}) → ${destStation.name} (region ${destRegionId})`,
    );

    // Batch fetch orders for all liquid items in both regions (much faster!)
    const stationIds = new Set([sourceStationId, destStationId]);
    const regionIds = new Set([sourceRegionId, destRegionId]);

    this.logger.log(
      `🔍 DEBUG: Looking for orders at stations: ${Array.from(stationIds).join(', ')} in regions: ${Array.from(regionIds).join(', ')}`,
    );

    this.logger.log(
      `⏱️  Starting batch fetch: ${liquidItemIds.length} items × ${regionIds.size} regions = ${liquidItemIds.length * regionIds.size} requests`,
    );
    const startTime = Date.now();

    // Create all requests to be batched
    const batchRequests: Array<{ regionId: number; itemTypeId: number }> = [];
    for (const regionId of regionIds) {
      for (const itemTypeId of liquidItemIds) {
        batchRequests.push({ regionId, itemTypeId });
      }
    }

    // Pre-fetch all item type names to avoid N+1 database queries
    const itemTypes = await this.prisma.itemType.findMany({
      where: { id: { in: liquidItemIds } },
      select: { id: true, name: true },
    });
    const itemTypeMap = new Map(itemTypes.map((item) => [item.id, item.name]));

    // Execute all requests in parallel with rate limiting
    const batchResults = await this.batchGetMarketOrders(batchRequests);

    // Process all results
    let totalOrdersFound = 0;
    let totalOrdersFiltered = 0;
    const ordersByStation = new Map<bigint, number>();

    for (const result of batchResults) {
      if (result.success && result.data && result.orders) {
        totalOrdersFound += result.orders.length;

        // Filter orders to only those at our specific stations
        const relevantOrders = result.orders.filter((order) =>
          stationIds.has(BigInt(order.location_id)),
        );

        totalOrdersFiltered += relevantOrders.length;

        // Count orders by station
        relevantOrders.forEach((order) => {
          const stationId = BigInt(order.location_id);
          ordersByStation.set(
            stationId,
            (ordersByStation.get(stationId) || 0) + 1,
          );
        });

        // Convert to our format
        for (const order of relevantOrders) {
          // Get item type name from pre-fetched map
          const itemTypeName = itemTypeMap.get(order.type_id);

          // DEBUG: Log Photonic orders being processed
          if (itemTypeName?.includes('Photonic Upgraded Co-Processor')) {
            this.logger.log(
              `🔍 ESI ROUTE ORDER: ${itemTypeName} - ${order.is_buy_order ? 'BUY' : 'SELL'} ${order.price} ISK (${order.volume_remain} units) at location ${order.location_id}`,
            );
          }

          allPrices.push({
            itemTypeId: order.type_id,
            itemTypeName: itemTypeName || `Type ${order.type_id}`,
            regionId: result.regionId,
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
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `⏱️  Batch fetch completed: ${allPrices.length} prices in ${duration}ms (${liquidItemIds.length} items × ${regionIds.size} regions)`,
    );

    // DEBUG: Log station filtering results
    this.logger.log(
      `🔍 DEBUG: Orders found: ${totalOrdersFound}, Orders after station filter: ${totalOrdersFiltered}`,
    );
    for (const [stationId, count] of ordersByStation) {
      this.logger.log(`🔍 DEBUG: Station ${stationId}: ${count} orders`);
    }

    return allPrices;
  }

  /**
   * Configure rate limiting for authenticated ESI access
   * Call this if you have an authenticated ESI application
   */
  configureAuthenticatedRateLimit(maxRequestsPerSecond: number = 400) {
    // Update rate limiting for authenticated access
    this.requestDelay = Math.ceil(1000 / maxRequestsPerSecond);
    this.logger.log(
      `ESI rate limiting updated for authenticated access: ${maxRequestsPerSecond} req/sec (${this.requestDelay}ms delay)`,
    );
  }

  /**
   * Get service statistics including queue information
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
      // Queue management stats
      queueLength: this.requestQueue.length,
      maxRequestsPerSecond: this.maxRequestsPerSecond,
      isProcessingQueue: this.isProcessingQueue,
    };
  }
}
