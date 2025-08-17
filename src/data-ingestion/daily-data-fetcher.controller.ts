import { Controller, Post, Get } from '@nestjs/common';
import { DailyDataFetcherService } from './daily-data-fetcher.service';
import { ErrorResponseDto } from '../reference-data/dto/reference-data.dto';
import { getErrorMessage } from '../common/interfaces/error.interface';

export interface DailyFetchResponseDto {
  success: boolean;
  message: string;
  data: {
    latestDateInDb: string | null;
    filesToFetch: string[];
    filesDownloaded: string[];
    filesImported: string[];
    filesFailed: string[];
    totalRecordsImported: number;
    fetchDuration: string;
  };
}

export interface AvailableFilesDto {
  success: boolean;
  data: {
    availableFiles: string[];
    totalFiles: number;
    oldestFile: string | null;
    newestFile: string | null;
  };
}

@Controller('daily-data')
export class DailyDataFetcherController {
  constructor(
    private readonly dailyDataFetcherService: DailyDataFetcherService,
  ) {}

  @Post('fetch')
  async fetchMissingDailyData(): Promise<
    DailyFetchResponseDto | ErrorResponseDto
  > {
    try {
      const result = await this.dailyDataFetcherService.fetchMissingDailyData();
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Daily data fetch failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('available')
  async checkAvailableFiles(): Promise<AvailableFilesDto | ErrorResponseDto> {
    try {
      const availableFiles =
        await this.dailyDataFetcherService.checkAvailableFiles();

      return {
        success: true,
        data: {
          availableFiles,
          totalFiles: availableFiles.length,
          oldestFile: availableFiles.length > 0 ? availableFiles[0] : null,
          newestFile:
            availableFiles.length > 0
              ? availableFiles[availableFiles.length - 1]
              : null,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to check available files: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get('status')
  async getDailyDataStatus(): Promise<{
    success: boolean;
    data: {
      latestDateInDb: string | null;
      daysBehind: number;
      upToDate: boolean;
      nextExpectedFile: string;
    };
  }> {
    try {
      // Get latest date in our database
      const latestRecord = await this.dailyDataFetcherService[
        'prisma'
      ].marketOrderTrade.findFirst({
        orderBy: { scanDate: 'desc' },
        select: { scanDate: true },
      });

      const latestDate = latestRecord?.scanDate;

      // Use UTC to avoid timezone issues
      const now = new Date();
      const today = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );

      // Expected latest date (yesterday, since files are created next day at 5:30 AM)
      const expectedLatestDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
      );

      let daysBehind = 0;
      let upToDate = true;

      if (latestDate) {
        // Convert to UTC date only (no time component)
        const latestDateOnly = new Date(
          Date.UTC(
            latestDate.getUTCFullYear(),
            latestDate.getUTCMonth(),
            latestDate.getUTCDate(),
          ),
        );

        const diffTime =
          expectedLatestDate.getTime() - latestDateOnly.getTime();
        daysBehind = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        upToDate = daysBehind === 0; // Up to date if we have yesterday's data exactly
      } else {
        upToDate = false;
        daysBehind = 999; // No data
      }

      // Generate next expected filename (for today's data, which becomes available tomorrow)
      const nextExpectedFile =
        this.dailyDataFetcherService['generateFilename'](today);

      return {
        success: true,
        data: {
          latestDateInDb: latestDate?.toISOString() || null,
          daysBehind,
          upToDate,
          nextExpectedFile,
        },
      };
    } catch {
      return {
        success: false,
        data: {
          latestDateInDb: null,
          daysBehind: 999,
          upToDate: false,
          nextExpectedFile: '',
        },
      };
    }
  }
}
