import { Controller, Post, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ReferenceDataService } from './reference-data.service';
import { Adam4EveFetcherService } from './adam4eve-fetcher.service';
import {
  ReferenceDataStatsDto,
  FreshDataResultDto,
  BootstrapResultDto,
  AvailabilityCheckDto,
  IndividualUpdateResultDto,
  VolumeUpdateResultDto,
} from './dto/reference-data.dto';
import { ErrorResponseDto } from '../common/dto/common-response.dto';
import { getErrorMessage } from '../common/interfaces/error.interface';

@ApiTags('reference-data')
@Controller('reference-data')
export class ReferenceDataController {
  constructor(
    private readonly referenceDataService: ReferenceDataService,
    private readonly adam4eveFetcherService: Adam4EveFetcherService,
  ) {}

  @Post('bootstrap')
  @ApiOperation({
    summary: 'Bootstrap reference data for new database',
    description:
      'Initialize a new database with fresh reference data from Adam4EVE. ' +
      'This endpoint will skip if data already exists, making it safe for repeated calls.',
  })
  @ApiResponse({
    status: 201,
    description: 'Reference data bootstrapped successfully',
    type: Object,
    schema: {
      example: {
        success: true,
        message: 'Successfully bootstrapped with fresh data from Adam4EVE',
        data: {
          method: 'fresh',
          stats: {
            regions: 115,
            solarSystems: 8000,
            stations: 5000,
            itemTypes: 15000,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bootstrap failed due to data unavailability',
  })
  async bootstrapReferenceData(): Promise<
    BootstrapResultDto | ErrorResponseDto
  > {
    try {
      const result = await this.adam4eveFetcherService.bootstrapReferenceData();
      return {
        success: true,
        message: result.message,
        data: {
          method: result.method,
          stats: result.stats,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Bootstrap failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Post('update-all')
  @ApiOperation({
    summary: 'Update all reference data',
    description:
      'Download and import fresh reference data for all data types (regions, solar systems, stations, item types) from Adam4EVE.',
  })
  @ApiResponse({
    status: 201,
    description: 'All reference data updated successfully',
    type: Object,
    schema: {
      example: {
        success: true,
        message: 'Fresh reference data fetch and import completed successfully',
        data: {
          downloadedFiles: 4,
          newItems: {
            regions: 2,
            solarSystems: 15,
            stations: 8,
            itemTypes: 150,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Update failed due to Adam4EVE unavailability',
  })
  async updateAllReferenceData(): Promise<
    FreshDataResultDto | ErrorResponseDto
  > {
    try {
      const result =
        await this.adam4eveFetcherService.fetchFreshReferenceData();
      return {
        success: true,
        message: 'Fresh reference data fetch and import completed successfully',
        data: {
          downloadedFiles: result.downloadedFiles.length,
          newItems: result.importStats,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Fresh data fetch failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Post('update/:dataType')
  @ApiOperation({
    summary: 'Update specific reference data type',
    description:
      'Download and import fresh data for a specific data type from Adam4EVE. ' +
      'Useful for targeted updates when you know a specific data type has been updated.',
  })
  @ApiParam({
    name: 'dataType',
    description: 'Type of reference data to update',
    enum: ['regions', 'solarSystems', 'stations', 'itemTypes'],
    example: 'regions',
  })
  @ApiResponse({
    status: 201,
    description: 'Specific reference data updated successfully',
    type: Object,
    schema: {
      example: {
        success: true,
        message: 'Regions data updated successfully',
        data: {
          dataType: 'regions',
          recordsProcessed: 115,
          recordsImported: 3,
          updateDuration: '1250ms',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data type or update failed',
  })
  async updateIndividualReferenceData(
    @Param('dataType') dataType: string,
  ): Promise<IndividualUpdateResultDto | ErrorResponseDto> {
    const validTypes = ['regions', 'solarSystems', 'stations', 'itemTypes'];
    if (!validTypes.includes(dataType)) {
      return {
        success: false,
        message: `Invalid data type. Must be one of: ${validTypes.join(', ')}`,
      };
    }

    try {
      const result =
        await this.adam4eveFetcherService.fetchIndividualReferenceData(
          dataType as 'regions' | 'solarSystems' | 'stations' | 'itemTypes',
        );

      return {
        success: true,
        message: `${dataType} data updated successfully`,
        data: {
          dataType: dataType as
            | 'regions'
            | 'solarSystems'
            | 'stations'
            | 'itemTypes',
          recordsProcessed: result.recordsImported, // All processed records were imported with upsert
          recordsImported: result.recordsImported,
          updateDuration: result.updateDuration,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `${dataType} update failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('check-availability')
  @ApiOperation({
    summary: 'Check Adam4EVE data availability',
    description:
      'Verify that all reference data files are available on Adam4EVE servers. ' +
      'Use this before attempting updates to ensure data sources are accessible.',
  })
  @ApiResponse({
    status: 200,
    description: 'Availability check completed',
    type: Object,
    schema: {
      example: {
        success: true,
        data: {
          available: true,
          files: [
            {
              name: 'region_ids.csv',
              available: true,
              lastModified: 'Wed, 01 Jan 2025 12:00:00 GMT',
            },
            {
              name: 'solarSystem_ids.csv',
              available: true,
              lastModified: 'Wed, 01 Jan 2025 12:00:00 GMT',
            },
          ],
        },
      },
    },
  })
  async checkAdam4EveAvailability(): Promise<
    AvailabilityCheckDto | ErrorResponseDto
  > {
    try {
      const availability =
        await this.adam4eveFetcherService.checkAdam4EveAvailability();
      return {
        success: true,
        data: availability,
      };
    } catch (error) {
      return {
        success: false,
        message: `Availability check failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get reference data statistics',
    description:
      'Retrieve current counts of reference data in the database. ' +
      'Useful for monitoring data completeness and tracking import progress.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: Object,
    schema: {
      example: {
        success: true,
        data: {
          regions: 115,
          solarSystems: 8439,
          stations: 5156,
          itemTypes: 15420,
        },
      },
    },
  })
  async getReferenceDataStats(): Promise<ReferenceDataStatsDto> {
    const stats = await this.referenceDataService.getReferenceDataStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Post('update-volumes')
  @ApiOperation({
    summary: 'Update item volumes from ESI',
    description:
      'Update volume data for items that are missing volume information by fetching from ESI. ' +
      'Only updates items with null volume values.',
  })
  @ApiResponse({
    status: 201,
    description: 'Volume update completed successfully',
    type: Object,
    schema: {
      example: {
        success: true,
        message: 'Volume update completed successfully',
        data: {
          totalProcessed: 150,
          updated: 135,
          errors: 15,
          updateDuration: '45000ms',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Volume update failed',
  })
  async updateItemVolumes(): Promise<VolumeUpdateResultDto | ErrorResponseDto> {
    try {
      const result = await this.referenceDataService.updateItemVolumes();
      return {
        success: true,
        message: 'Volume update completed successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Volume update failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Post('update-all-volumes')
  @ApiOperation({
    summary: 'Update all item volumes from ESI',
    description:
      'Comprehensive volume update for all item types from ESI. ' +
      'This is typically used during initial seeding or complete refresh.',
  })
  @ApiResponse({
    status: 201,
    description: 'Comprehensive volume update completed successfully',
    type: Object,
    schema: {
      example: {
        success: true,
        message: 'Comprehensive volume update completed successfully',
        data: {
          totalProcessed: 15420,
          updated: 8750,
          errors: 45,
          updateDuration: '1800000ms',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Comprehensive volume update failed',
  })
  async updateAllItemVolumes(): Promise<
    VolumeUpdateResultDto | ErrorResponseDto
  > {
    try {
      const result = await this.referenceDataService.updateAllItemVolumes();
      return {
        success: true,
        message: 'Comprehensive volume update completed successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Comprehensive volume update failed: ${getErrorMessage(error)}`,
      };
    }
  }
}
