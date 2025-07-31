import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import {
  RegionCsvRow,
  SolarSystemCsvRow,
  StationCsvRow,
  ItemTypeCsvRow,
  ImportStats,
} from './interfaces/csv-data.interface';
import { getErrorMessage } from '../common/interfaces/error.interface';

@Injectable()
export class ReferenceDataService {
  private readonly logger = new Logger(ReferenceDataService.name);

  constructor(private prisma: PrismaService) {}

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

  async importAllReferenceData(dataDir: string = 'doc'): Promise<void> {
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
}
