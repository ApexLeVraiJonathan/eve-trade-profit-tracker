import { Injectable, Logger } from '@nestjs/common';
import { ReferenceDataService } from './reference-data.service';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import {
  FetchResult,
  BootstrapResult,
  FileAvailability,
} from './interfaces/csv-data.interface';
import { getErrorMessage } from '../common/interfaces/error.interface';

@Injectable()
export class Adam4EveFetcherService {
  private readonly logger = new Logger(Adam4EveFetcherService.name);
  private readonly baseUrl = 'https://static.adam4eve.eu/IDs';

  private readonly referenceFiles = [
    'region_ids.csv',
    'solarSystem_ids.csv',
    'npcStation_ids.csv',
    'type_ids.csv',
  ];

  constructor(private referenceDataService: ReferenceDataService) {}

  private async downloadFile(url: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);

      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `HTTP ${response.statusCode}: ${response.statusMessage}`,
              ),
            );
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });

          file.on('error', (err) => {
            fs.unlink(filePath, () => {}); // Delete partial file
            reject(err);
          });
        })
        .on('error', reject);
    });
  }

  async fetchFreshReferenceData(
    downloadDir: string = 'temp',
  ): Promise<FetchResult> {
    this.logger.log('Starting fresh reference data fetch from Adam4EVE');

    // Create temp directory
    const tempDir = path.resolve(downloadDir);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const downloadedFiles: string[] = [];

    try {
      // Download all reference files
      for (const fileName of this.referenceFiles) {
        const url = `${this.baseUrl}/${fileName}`;
        const filePath = path.join(tempDir, fileName);

        this.logger.log(`Downloading ${fileName} from ${url}`);
        await this.downloadFile(url, filePath);
        downloadedFiles.push(filePath);
        this.logger.log(`Downloaded ${fileName} successfully`);
      }

      // Import the downloaded data
      this.logger.log('Importing downloaded reference data');
      const statsBeforeImport =
        await this.referenceDataService.getReferenceDataStats();

      await this.referenceDataService.importAllReferenceData(tempDir);

      const statsAfterImport =
        await this.referenceDataService.getReferenceDataStats();

      // Calculate differences
      const importStats = {
        regions: statsAfterImport.regions - statsBeforeImport.regions,
        solarSystems:
          statsAfterImport.solarSystems - statsBeforeImport.solarSystems,
        stations: statsAfterImport.stations - statsBeforeImport.stations,
        itemTypes: statsAfterImport.itemTypes - statsBeforeImport.itemTypes,
      };

      this.logger.log('Fresh reference data import completed successfully');
      this.logger.log(
        `Import results: +${importStats.regions} regions, +${importStats.solarSystems} solar systems, +${importStats.stations} stations, +${importStats.itemTypes} item types`,
      );

      return {
        downloadedFiles,
        importStats,
      };
    } catch (error) {
      this.logger.error(
        `Fresh reference data fetch failed: ${getErrorMessage(error)}`,
      );
      throw error;
    } finally {
      // Cleanup temp files
      this.cleanupTempFiles(downloadedFiles);
    }
  }

  private cleanupTempFiles(filePaths: string[]): void {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.log(`Cleaned up temp file: ${filePath}`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to cleanup temp file ${filePath}: ${getErrorMessage(error)}`,
        );
      }
    }

    // Note: We don't remove the temp/ directory since it's shared across modules
    this.logger.log(
      'Cleanup completed (temp directory preserved for shared use)',
    );
  }

  async checkAdam4EveAvailability(): Promise<FileAvailability> {
    this.logger.log('Checking Adam4EVE reference data availability');

    const fileStatus = await Promise.all(
      this.referenceFiles.map(async (fileName) => {
        try {
          const url = `${this.baseUrl}/${fileName}`;

          return new Promise<{
            name: string;
            available: boolean;
            lastModified?: string;
          }>((resolve) => {
            https
              .request(url, { method: 'HEAD' }, (response) => {
                const available = response.statusCode === 200;
                const lastModified = response.headers['last-modified'];

                resolve({
                  name: fileName,
                  available,
                  lastModified: (lastModified as string) || undefined,
                });
              })
              .on('error', () => {
                resolve({
                  name: fileName,
                  available: false,
                });
              })
              .end();
          });
        } catch {
          return {
            name: fileName,
            available: false,
          };
        }
      }),
    );

    const allAvailable = fileStatus.every((file) => file.available);

    return {
      available: allAvailable,
      files: fileStatus,
    };
  }

  async fetchIndividualReferenceData(
    dataType: 'regions' | 'solarSystems' | 'stations' | 'itemTypes',
  ): Promise<{ recordsImported: number; updateDuration: string }> {
    const startTime = new Date();
    this.logger.log(`Starting individual ${dataType} data fetch from Adam4EVE`);

    const fileMap = {
      regions: 'region_ids.csv',
      solarSystems: 'solarSystem_ids.csv',
      stations: 'npcStation_ids.csv',
      itemTypes: 'type_ids.csv',
    };

    const fileName = fileMap[dataType];
    const tempDir = path.resolve('temp');

    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const url = `${this.baseUrl}/${fileName}`;
    const filePath = path.join(tempDir, fileName);

    try {
      // Download the file
      this.logger.log(`Downloading ${fileName} from ${url}`);
      await this.downloadFile(url, filePath);
      this.logger.log(`Downloaded ${fileName} successfully`);

      // Import the data
      let recordsImported: number;
      switch (dataType) {
        case 'regions':
          recordsImported =
            await this.referenceDataService.importRegions(filePath);
          break;
        case 'solarSystems':
          recordsImported =
            await this.referenceDataService.importSolarSystems(filePath);
          break;
        case 'stations':
          recordsImported =
            await this.referenceDataService.importStations(filePath);
          break;
        case 'itemTypes':
          recordsImported =
            await this.referenceDataService.importItemTypes(filePath);
          break;
      }

      const endTime = new Date();
      const updateDuration = `${endTime.getTime() - startTime.getTime()}ms`;

      this.logger.log(
        `Successfully updated ${dataType}: ${recordsImported} records in ${updateDuration}`,
      );

      return { recordsImported, updateDuration };
    } catch (error) {
      this.logger.error(
        `Individual ${dataType} fetch failed: ${getErrorMessage(error)}`,
      );
      throw error;
    } finally {
      // Cleanup temp files
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.log(`Cleaned up temp file: ${filePath}`);
        }
        // Note: We don't remove the temp/ directory since it's shared across modules
      } catch (error) {
        this.logger.warn(
          `Failed to cleanup temp file ${filePath}: ${getErrorMessage(error)}`,
        );
      }
    }
  }

  async bootstrapReferenceData(): Promise<BootstrapResult> {
    this.logger.log('Starting reference data bootstrap');

    // Check if we already have data
    const isEmpty = await this.referenceDataService.isReferenceDataEmpty();
    if (!isEmpty) {
      this.logger.log('Reference data already exists, skipping bootstrap');
      return {
        method: 'skipped',
        message: 'Reference data already exists',
      };
    }

    // Try fresh data first (production-ready approach)
    try {
      this.logger.log('Attempting to fetch fresh data from Adam4EVE...');
      const result = await this.fetchFreshReferenceData();
      return {
        method: 'fresh',
        message: 'Successfully bootstrapped with fresh data from Adam4EVE',
        stats: result.importStats,
      };
    } catch (error) {
      this.logger.warn(`Fresh data fetch failed: ${getErrorMessage(error)}`);
      throw new Error(
        `Bootstrap failed: Fresh data unavailable. Please check Adam4EVE availability.`,
      );
    }
  }
}
