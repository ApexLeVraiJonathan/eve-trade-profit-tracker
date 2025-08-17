import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataImportService } from './market-data-import.service';
import { TrackedStationService } from '../station-management/tracked-station.service';
import { getErrorMessage } from '../common/interfaces/error.interface';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

export interface DailyFetchResult {
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

@Injectable()
export class DailyDataFetcherService {
  private readonly logger = new Logger(DailyDataFetcherService.name);
  private readonly ADAM4EVE_BASE_URL =
    'https://static.adam4eve.eu/MarketOrdersTrades/2025/';
  private readonly MAX_DAYS_BACK = 16; // Adam4EVE only keeps last 16 days
  private readonly TEMP_DIR = path.resolve('temp', 'daily_data');

  constructor(
    private prisma: PrismaService,
    private marketDataImportService: MarketDataImportService,
    private trackedStationService: TrackedStationService,
  ) {}

  async fetchMissingDailyData(): Promise<DailyFetchResult> {
    const startTime = new Date();
    this.logger.log('Starting daily data fetch process');

    const result: DailyFetchResult = {
      success: false,
      message: '',
      data: {
        latestDateInDb: null,
        filesToFetch: [],
        filesDownloaded: [],
        filesImported: [],
        filesFailed: [],
        totalRecordsImported: 0,
        fetchDuration: '',
      },
    };

    try {
      // Ensure we have tracked stations
      const trackedStations =
        await this.trackedStationService.getActiveStationIds();
      if (trackedStations.length === 0) {
        this.logger.warn('No tracked stations found, initializing defaults');
        await this.trackedStationService.initializeDefaultStations();
      }

      // 1. Get the latest date we have in our database
      const latestDate = await this.getLatestDateInDatabase();
      result.data.latestDateInDb = latestDate?.toISOString() || null;

      this.logger.log(
        `Latest date in database: ${latestDate?.toISOString() || 'No data'}`,
      );

      // 2. Determine which files we need to fetch
      const filesToFetch = this.calculateMissingFiles(latestDate);
      result.data.filesToFetch = filesToFetch;

      if (filesToFetch.length === 0) {
        result.success = true;
        result.message = 'No missing files to fetch - database is up to date';
        result.data.fetchDuration = `${new Date().getTime() - startTime.getTime()}ms`;
        return result;
      }

      this.logger.log(
        `Found ${filesToFetch.length} files to fetch: ${filesToFetch.join(', ')}`,
      );

      // 3. Create temp directory
      this.ensureTempDirectory();

      // 4. Download and import each missing file
      for (const filename of filesToFetch) {
        try {
          const downloaded = await this.downloadDailyFile(filename);
          if (downloaded) {
            result.data.filesDownloaded.push(filename);

            const imported = await this.importDownloadedFile(filename);
            if (imported) {
              result.data.filesImported.push(filename);
              result.data.totalRecordsImported += imported.imported;
              this.logger.log(
                `Successfully imported ${imported.imported} records from ${filename}`,
              );
            } else {
              result.data.filesFailed.push(filename);
            }
          } else {
            this.logger.warn(
              `File ${filename} not available yet or failed to download`,
            );
            result.data.filesFailed.push(filename);
          }
        } catch (error) {
          this.logger.error(
            `Failed to process ${filename}: ${getErrorMessage(error)}`,
          );
          result.data.filesFailed.push(filename);
        }
      }

      // 5. Cleanup temp files
      this.cleanupTempFiles();

      const endTime = new Date();
      result.data.fetchDuration = `${endTime.getTime() - startTime.getTime()}ms`;

      if (result.data.filesImported.length > 0) {
        result.success = true;
        result.message = `Successfully imported ${result.data.filesImported.length} daily files with ${result.data.totalRecordsImported} total records`;
      } else if (result.data.filesFailed.length === filesToFetch.length) {
        result.success = false;
        result.message = 'All files failed to download or import';
      } else {
        result.success = true;
        result.message = 'Partial success - some files were not available yet';
      }

      this.logger.log(`Daily fetch completed: ${result.message}`);
      return result;
    } catch (error) {
      const endTime = new Date();
      result.data.fetchDuration = `${endTime.getTime() - startTime.getTime()}ms`;
      result.success = false;
      result.message = `Daily fetch failed: ${getErrorMessage(error)}`;
      this.logger.error(
        `Daily fetch process failed: ${getErrorMessage(error)}`,
      );

      // Cleanup on error
      this.cleanupTempFiles();
      return result;
    }
  }

  private async getLatestDateInDatabase(): Promise<Date | null> {
    const latestRecord = await this.prisma.marketOrderTrade.findFirst({
      orderBy: { scanDate: 'desc' },
      select: { scanDate: true },
    });

    return latestRecord?.scanDate || null;
  }

  private calculateMissingFiles(latestDate: Date | null): string[] {
    const today = new Date();
    const files: string[] = [];

    // If no data in DB, start from 16 days ago (max Adam4EVE keeps)
    let startDate: Date;
    if (!latestDate) {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - this.MAX_DAYS_BACK);
    } else {
      // Start from the day after our latest data
      startDate = new Date(latestDate);
      startDate.setDate(latestDate.getDate() + 1);
    }

    // Don't go back more than MAX_DAYS_BACK
    const earliestAllowed = new Date(today);
    earliestAllowed.setDate(today.getDate() - this.MAX_DAYS_BACK);

    if (startDate < earliestAllowed) {
      startDate = earliestAllowed;
    }

    // Generate filenames for missing dates
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      const filename = this.generateFilename(currentDate);
      files.push(filename);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return files;
  }

  private generateFilename(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `marketOrderTrades_daily_${year}-${month}-${day}.csv`;
  }

  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
    }
  }

  private async downloadDailyFile(filename: string): Promise<boolean> {
    const url = `${this.ADAM4EVE_BASE_URL}${filename}`;
    const localPath = path.join(this.TEMP_DIR, filename);

    this.logger.log(`Downloading ${filename} from ${url}`);

    return new Promise((resolve) => {
      const request = https.get(url, (response) => {
        if (response.statusCode === 200) {
          const file = fs.createWriteStream(localPath);
          response.pipe(file);

          file.on('finish', () => {
            file.close();
            this.logger.log(`Successfully downloaded ${filename}`);
            resolve(true);
          });

          file.on('error', (error) => {
            this.logger.error(
              `File write error for ${filename}: ${getErrorMessage(error)}`,
            );
            resolve(false);
          });
        } else {
          this.logger.warn(
            `File ${filename} not found (HTTP ${response.statusCode})`,
          );
          resolve(false);
        }
      });

      request.on('error', (error) => {
        this.logger.error(
          `Download error for ${filename}: ${getErrorMessage(error)}`,
        );
        resolve(false);
      });

      request.setTimeout(30000, () => {
        this.logger.error(`Download timeout for ${filename}`);
        request.abort();
        resolve(false);
      });
    });
  }

  private async importDownloadedFile(
    filename: string,
  ): Promise<{ imported: number } | null> {
    const localPath = path.join(this.TEMP_DIR, filename);

    if (!fs.existsSync(localPath)) {
      this.logger.error(
        `Downloaded file ${filename} not found at ${localPath}`,
      );
      return null;
    }

    try {
      const stats =
        await this.marketDataImportService.importMarketDataFromFile(localPath);
      return { imported: stats.imported };
    } catch (error) {
      this.logger.error(
        `Import failed for ${filename}: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  private cleanupTempFiles(): void {
    try {
      if (fs.existsSync(this.TEMP_DIR)) {
        const files = fs.readdirSync(this.TEMP_DIR);
        for (const file of files) {
          fs.unlinkSync(path.join(this.TEMP_DIR, file));
        }
        fs.rmdirSync(this.TEMP_DIR);
        this.logger.log('Cleaned up temporary files');
      }
    } catch (error) {
      this.logger.warn(
        `Failed to cleanup temp directory: ${getErrorMessage(error)}`,
      );
    }
  }

  // Utility method to check what files are available on Adam4EVE
  async checkAvailableFiles(): Promise<string[]> {
    const today = new Date();
    const availableFiles: string[] = [];

    // Check last 16 days
    for (let i = 0; i <= this.MAX_DAYS_BACK; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const filename = this.generateFilename(checkDate);

      const isAvailable = await this.checkFileExists(filename);
      if (isAvailable) {
        availableFiles.push(filename);
      }
    }

    return availableFiles.reverse(); // Oldest first
  }

  private async checkFileExists(filename: string): Promise<boolean> {
    const url = `${this.ADAM4EVE_BASE_URL}${filename}`;

    return new Promise((resolve) => {
      const request = https.request(url, { method: 'HEAD' }, (response) => {
        resolve(response.statusCode === 200);
      });

      request.on('error', () => {
        resolve(false);
      });

      request.setTimeout(5000, () => {
        request.abort();
        resolve(false);
      });

      request.end();
    });
  }
}
