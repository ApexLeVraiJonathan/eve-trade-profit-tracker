import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTrackedStationDto,
  UpdateTrackedStationDto,
  TrackedStationDto,
} from './dto/tracked-station.dto';

import { getErrorMessage } from '../common/interfaces/error.interface';

@Injectable()
export class TrackedStationService {
  private readonly logger = new Logger(TrackedStationService.name);

  constructor(private prisma: PrismaService) {}

  async createTrackedStation(
    createDto: CreateTrackedStationDto,
  ): Promise<TrackedStationDto> {
    this.logger.log(`Adding tracked station: ${createDto.stationId}`);

    const stationId = BigInt(createDto.stationId);

    // Check if station exists in our reference data
    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
      include: { solarSystem: { include: { region: true } } },
    });

    if (!station) {
      throw new NotFoundException(
        `Station with ID ${createDto.stationId} not found in reference data`,
      );
    }

    // Check if already tracked
    const existing = await this.prisma.trackedStation.findUnique({
      where: { stationId },
    });

    if (existing) {
      throw new ConflictException(
        `Station ${station.name} is already being tracked`,
      );
    }

    try {
      const trackedStation = await this.prisma.trackedStation.create({
        data: {
          stationId,
          name: station.name,
          notes: createDto.notes,
        },
      });

      this.logger.log(`Successfully added tracked station: ${station.name}`);

      return this.toDto(trackedStation);
    } catch (error) {
      this.logger.error(
        `Failed to create tracked station: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async getAllTrackedStations(): Promise<TrackedStationDto[]> {
    const trackedStations = await this.prisma.trackedStation.findMany({
      orderBy: { addedDate: 'desc' },
    });

    return trackedStations.map((station) => this.toDto(station));
  }

  async getActiveTrackedStations(): Promise<TrackedStationDto[]> {
    const trackedStations = await this.prisma.trackedStation.findMany({
      where: { isActive: true },
      orderBy: { addedDate: 'desc' },
    });

    return trackedStations.map((station) => this.toDto(station));
  }

  async getTrackedStationById(id: number): Promise<TrackedStationDto> {
    const trackedStation = await this.prisma.trackedStation.findUnique({
      where: { id },
    });

    if (!trackedStation) {
      throw new NotFoundException(`Tracked station with ID ${id} not found`);
    }

    return this.toDto(trackedStation);
  }

  async updateTrackedStation(
    id: number,
    updateDto: UpdateTrackedStationDto,
  ): Promise<TrackedStationDto> {
    this.logger.log(`Updating tracked station ID: ${id}`);

    const existing = await this.prisma.trackedStation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Tracked station with ID ${id} not found`);
    }

    try {
      const updated = await this.prisma.trackedStation.update({
        where: { id },
        data: updateDto,
      });

      this.logger.log(`Successfully updated tracked station: ${updated.name}`);

      return this.toDto(updated);
    } catch (error) {
      this.logger.error(
        `Failed to update tracked station: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async removeTrackedStation(id: number): Promise<void> {
    this.logger.log(`Removing tracked station ID: ${id}`);

    const existing = await this.prisma.trackedStation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Tracked station with ID ${id} not found`);
    }

    try {
      await this.prisma.trackedStation.delete({
        where: { id },
      });

      this.logger.log(`Successfully removed tracked station: ${existing.name}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove tracked station: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async getTrackedStationStats() {
    const [total, active, oldest, newest] = await Promise.all([
      this.prisma.trackedStation.count(),
      this.prisma.trackedStation.count({ where: { isActive: true } }),
      this.prisma.trackedStation.findFirst({
        orderBy: { addedDate: 'asc' },
        select: { addedDate: true },
      }),
      this.prisma.trackedStation.findFirst({
        orderBy: { addedDate: 'desc' },
        select: { addedDate: true },
      }),
    ]);

    return {
      totalTracked: total,
      activeStations: active,
      inactiveStations: total - active,
      oldestAdded: oldest?.addedDate?.toISOString() || '',
      newestAdded: newest?.addedDate?.toISOString() || '',
    };
  }

  // Get tracked station IDs for market data filtering
  async getActiveStationIds(): Promise<bigint[]> {
    const trackedStations = await this.prisma.trackedStation.findMany({
      where: { isActive: true },
      select: { stationId: true },
    });

    return trackedStations.map((station) => station.stationId);
  }

  // Initialize with the 4 major trade hubs
  async initializeDefaultStations(): Promise<void> {
    this.logger.log('Initializing default tracked stations');

    const defaultStations = [
      {
        stationId: '60008494',
        notes: 'Amarr - Major trade hub',
      },
      {
        stationId: '60011866',
        notes: 'Dodixie - Major trade hub',
      },
      {
        stationId: '60005686',
        notes: 'Hek - Major trade hub',
      },
      {
        stationId: '60004588',
        notes: 'Rens - Major trade hub',
      },
    ];

    for (const stationData of defaultStations) {
      try {
        const existing = await this.prisma.trackedStation.findUnique({
          where: { stationId: BigInt(stationData.stationId) },
        });

        if (!existing) {
          await this.createTrackedStation(stationData);
        } else {
          this.logger.log(
            `Station ${stationData.stationId} already tracked, skipping`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to initialize station ${stationData.stationId}: ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log('Default tracked stations initialization completed');
  }

  private toDto(trackedStation: {
    id: number;
    stationId: bigint;
    name: string;
    isActive: boolean;
    addedDate: Date;
    notes: string | null;
  }): TrackedStationDto {
    return {
      id: trackedStation.id,
      stationId: trackedStation.stationId.toString(),
      name: trackedStation.name,
      isActive: trackedStation.isActive,
      addedDate: trackedStation.addedDate.toISOString(),
      notes: trackedStation.notes ?? undefined,
    };
  }
}
