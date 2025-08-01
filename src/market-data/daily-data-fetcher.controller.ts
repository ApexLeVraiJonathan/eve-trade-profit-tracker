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
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      let daysBehind = 0;
      let upToDate = true;

      if (latestDate) {
        const latestDateOnly = new Date(latestDate);
        latestDateOnly.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - latestDateOnly.getTime();
        daysBehind = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        upToDate = daysBehind <= 1; // Allow 1 day lag (file might not be ready yet)
      } else {
        upToDate = false;
        daysBehind = 999; // No data
      }

      // Generate next expected filename
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const nextExpectedFile =
        this.dailyDataFetcherService['generateFilename'](tomorrow);

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
