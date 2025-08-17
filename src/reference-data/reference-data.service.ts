import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EsiService } from '../esi/esi.service';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import {
  RegionCsvRow,
  SolarSystemCsvRow,
  StationCsvRow,
  ItemTypeCsvRow,
  ImportStats,
  VolumeUpdateResult,
} from './interfaces/csv-data.interface';
import { getErrorMessage } from '../common/interfaces/error.interface';

@Injectable()
export class ReferenceDataService {
  private readonly logger = new Logger(ReferenceDataService.name);

  constructor(
    private prisma: PrismaService,
    private esiService: EsiService,
  ) {}

  async importRegions(filePath: string): Promise<number> {
    this.logger.log(`Importing regions from ${filePath}`);

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const rows: RegionCsvRow[] = parse(csvContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
    });

    let imported = 0;

    for (const row of rows) {
      try {
        await this.prisma.region.upsert({
          where: { id: parseInt(row.regionID) },
          update: {
            name: row.regionName.replace(/"/g, ''), // Remove quotes
          },
          create: {
            id: parseInt(row.regionID),
            name: row.regionName.replace(/"/g, ''),
          },
        });
        imported++;
      } catch (error) {
        this.logger.error(
          `Failed to import region ${row.regionID}: ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(`Imported ${imported} regions`);
    return imported;
  }

  async importSolarSystems(filePath: string): Promise<number> {
    this.logger.log(`Importing solar systems from ${filePath}`);

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const rows: SolarSystemCsvRow[] = parse(csvContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
    });

    let imported = 0;

    for (const row of rows) {
      try {
        await this.prisma.solarSystem.upsert({
          where: { id: parseInt(row.solarSystemID) },
          update: {
            name: row.solarSystemName,
            regionId: parseInt(row.regionID),
          },
          create: {
            id: parseInt(row.solarSystemID),
            name: row.solarSystemName,
            regionId: parseInt(row.regionID),
          },
        });
        imported++;
      } catch (error) {
        this.logger.error(
          `Failed to import solar system ${row.solarSystemID}: ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(`Imported ${imported} solar systems`);
    return imported;
  }

  async importStations(filePath: string): Promise<number> {
    this.logger.log(`Importing stations from ${filePath}`);

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const rows: StationCsvRow[] = parse(csvContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
    });

    let imported = 0;

    for (const row of rows) {
      try {
        await this.prisma.station.upsert({
          where: { id: BigInt(row.stationID) },
          update: {
            name: row.stationName.replace(/"/g, ''),
            solarSystemId: parseInt(row.solarSystemID),
          },
          create: {
            id: BigInt(row.stationID),
            name: row.stationName.replace(/"/g, ''),
            solarSystemId: parseInt(row.solarSystemID),
          },
        });
        imported++;
      } catch (error) {
        this.logger.error(
          `Failed to import station ${row.stationID}: ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(`Imported ${imported} stations`);
    return imported;
  }

  async importItemTypes(filePath: string): Promise<number> {
    this.logger.log(`Importing item types from ${filePath}`);

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const rows: ItemTypeCsvRow[] = parse(csvContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
    });

    let imported = 0;

    // Process in batches to avoid memory issues with large file
    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      try {
        const operations = batch.map((row) =>
          this.prisma.itemType.upsert({
            where: { id: parseInt(row.typeID) },
            update: {
              name: row.typeName.replace(/"/g, ''),
              published: row.published === '1',
            },
            create: {
              id: parseInt(row.typeID),
              name: row.typeName.replace(/"/g, ''),
              published: row.published === '1',
            },
          }),
        );

        await this.prisma.$transaction(operations);
        imported += batch.length;

        this.logger.log(
          `Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)} (${imported}/${rows.length} item types)`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to import item types batch starting at ${i}: ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(`Imported ${imported} item types`);
    return imported;
  }

  async importAllReferenceData(dataDir: string): Promise<void> {
    this.logger.log('Starting full reference data import');

    const basePath = path.resolve(dataDir);

    try {
      // Import in dependency order: regions first, then solar systems, then stations, then item types
      await this.importRegions(path.join(basePath, 'region_ids.csv'));
      await this.importSolarSystems(path.join(basePath, 'solarSystem_ids.csv'));
      await this.importStations(path.join(basePath, 'npcStation_ids.csv'));
      await this.importItemTypes(path.join(basePath, 'type_ids.csv'));

      this.logger.log('Reference data import completed successfully');
    } catch (error) {
      this.logger.error(
        `Reference data import failed: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async getReferenceDataStats(): Promise<ImportStats> {
    const [regions, solarSystems, stations, itemTypes] = await Promise.all([
      this.prisma.region.count(),
      this.prisma.solarSystem.count(),
      this.prisma.station.count(),
      this.prisma.itemType.count(),
    ]);

    return { regions, solarSystems, stations, itemTypes };
  }

  async isReferenceDataEmpty(): Promise<boolean> {
    const stats = await this.getReferenceDataStats();
    return Object.values(stats).every((count) => count === 0);
  }

  /**
   * Update item volumes from ESI
   */
  async updateItemVolumes(): Promise<VolumeUpdateResult> {
    const startTime = new Date();
    this.logger.log('Starting item volume update from ESI...');

    // Get all item types that need volume updates (volume is null)
    const itemsToUpdate = await this.prisma.itemType.findMany({
      where: { volume: null },
      select: { id: true, name: true },
    });

    this.logger.log(
      `Found ${itemsToUpdate.length} items that need volume updates`,
    );

    if (itemsToUpdate.length === 0) {
      const endTime = new Date();
      return {
        totalProcessed: 0,
        updated: 0,
        errors: 0,
        updateDuration: `${endTime.getTime() - startTime.getTime()}ms`,
      };
    }

    let updated = 0;
    let errors = 0;

    // Process items in batches to avoid overwhelming ESI
    const batchSize = 50;
    for (let i = 0; i < itemsToUpdate.length; i += batchSize) {
      const batch = itemsToUpdate.slice(i, i + batchSize);
      this.logger.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(itemsToUpdate.length / batchSize)}`,
      );

      const batchPromises = batch.map(async (item) => {
        try {
          const typeInfoResponse = await this.esiService.getTypeInfo(item.id);

          if (typeInfoResponse.success && typeInfoResponse.data) {
            await this.prisma.itemType.update({
              where: { id: item.id },
              data: { volume: typeInfoResponse.data.volume },
            });

            updated++;
            this.logger.debug(
              `Updated volume for ${item.name}: ${typeInfoResponse.data.volume}`,
            );
          } else {
            errors++;
            this.logger.warn(
              `Failed to get type info for ${item.name}: ${typeInfoResponse.error || 'Unknown error'}`,
            );
          }
        } catch (error) {
          errors++;
          this.logger.warn(
            `Failed to update volume for ${item.name}: ${getErrorMessage(error)}`,
          );
        }
      });

      await Promise.allSettled(batchPromises);
    }

    const endTime = new Date();
    const updateDuration = `${endTime.getTime() - startTime.getTime()}ms`;

    this.logger.log(
      `Volume update completed: ${updated} updated, ${errors} errors in ${updateDuration}`,
    );

    return {
      totalProcessed: itemsToUpdate.length,
      updated,
      errors,
      updateDuration,
    };
  }

  /**
   * Update volumes for all item types during seeding
   */
  async updateAllItemVolumes(): Promise<VolumeUpdateResult> {
    const startTime = new Date();
    this.logger.log('Starting comprehensive item volume update from ESI...');

    // Get all item types (for seeding)
    const allItems = await this.prisma.itemType.findMany({
      select: { id: true, name: true, volume: true },
    });

    this.logger.log(`Found ${allItems.length} total item types`);

    let updated = 0;
    let errors = 0;

    // Process items in smaller batches for comprehensive update
    const batchSize = 25;
    for (let i = 0; i < allItems.length; i += batchSize) {
      const batch = allItems.slice(i, i + batchSize);
      this.logger.log(
        `Processing volume batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allItems.length / batchSize)}`,
      );

      const batchPromises = batch.map(async (item) => {
        try {
          const typeInfoResponse = await this.esiService.getTypeInfo(item.id);

          if (typeInfoResponse.success && typeInfoResponse.data) {
            // Only update if volume is different (upsert behavior)
            if (item.volume !== typeInfoResponse.data.volume) {
              await this.prisma.itemType.update({
                where: { id: item.id },
                data: { volume: typeInfoResponse.data.volume },
              });
              updated++;
            }
          } else {
            errors++;
            this.logger.warn(
              `Failed to get type info for ${item.name}: ${typeInfoResponse.error || 'Unknown error'}`,
            );
          }
        } catch (error) {
          errors++;
          this.logger.warn(
            `Failed to update volume for ${item.name}: ${getErrorMessage(error)}`,
          );
        }
      });

      await Promise.allSettled(batchPromises);
    }

    const endTime = new Date();
    const updateDuration = `${endTime.getTime() - startTime.getTime()}ms`;

    this.logger.log(
      `Comprehensive volume update completed: ${updated} updated, ${errors} errors in ${updateDuration}`,
    );

    return {
      totalProcessed: allItems.length,
      updated,
      errors,
      updateDuration,
    };
  }
}
