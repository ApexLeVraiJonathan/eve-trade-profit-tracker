import { Controller, Post, Get } from '@nestjs/common';
import { ReferenceDataService } from './reference-data.service';
import { Adam4EveFetcherService } from './adam4eve-fetcher.service';
import {
  ReferenceDataStatsDto,
  ImportResultDto,
  FreshDataResultDto,
  BootstrapResultDto,
  AvailabilityCheckDto,
  ErrorResponseDto,
} from './dto/reference-data.dto';
import { getErrorMessage } from '../common/interfaces/error.interface';

@Controller('reference-data')
export class ReferenceDataController {
  constructor(
    private readonly referenceDataService: ReferenceDataService,
    private readonly adam4eveFetcherService: Adam4EveFetcherService,
  ) {}

  @Post('import')
  async importReferenceData(): Promise<ImportResultDto | ErrorResponseDto> {
    // NOTE: This endpoint imports from local doc/ folder
    // Primarily for development and emergency fallback
    // Production should use POST /fetch-fresh instead
    try {
      await this.referenceDataService.importAllReferenceData();
      return {
        success: true,
        message:
          'Reference data import completed successfully (from local files)',
      };
    } catch (error) {
      return {
        success: false,
        message: `Import failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Post('fetch-fresh')
  async fetchFreshReferenceData(): Promise<
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

  @Post('bootstrap')
  async bootstrapReferenceData(): Promise<
    BootstrapResultDto | ErrorResponseDto
  > {
    // PRODUCTION ENDPOINT: Smart bootstrap that tries fresh data first,
    // falls back to local files, or skips if data already exists
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

  @Get('check-availability')
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
  async getReferenceDataStats(): Promise<ReferenceDataStatsDto> {
    const stats = await this.referenceDataService.getReferenceDataStats();
    return {
      success: true,
      data: stats,
    };
  }
}
