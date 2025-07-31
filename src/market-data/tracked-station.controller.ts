import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { TrackedStationService } from './tracked-station.service';
import {
  CreateTrackedStationDto,
  UpdateTrackedStationDto,
  TrackedStationListDto,
  TrackedStationResponseDto,
  TrackedStationStatsDto,
} from './dto/tracked-station.dto';
import { ErrorResponseDto } from '../reference-data/dto/reference-data.dto';
import { getErrorMessage } from '../common/interfaces/error.interface';

@Controller('tracked-stations')
export class TrackedStationController {
  constructor(private readonly trackedStationService: TrackedStationService) {}

  @Post()
  async createTrackedStation(
    @Body() createDto: CreateTrackedStationDto,
  ): Promise<TrackedStationResponseDto | ErrorResponseDto> {
    try {
      const station =
        await this.trackedStationService.createTrackedStation(createDto);
      return {
        success: true,
        data: station,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add tracked station: ${getErrorMessage(error)}`,
      };
    }
  }

  @Get()
  async getAllTrackedStations(): Promise<TrackedStationListDto> {
    const stations = await this.trackedStationService.getAllTrackedStations();
    return {
      success: true,
      data: stations,
    };
  }

  @Get('active')
  async getActiveTrackedStations(): Promise<TrackedStationListDto> {
    const stations =
      await this.trackedStationService.getActiveTrackedStations();
    return {
      success: true,
      data: stations,
    };
  }

  @Get('stats')
  async getTrackedStationStats(): Promise<TrackedStationStatsDto> {
    const stats = await this.trackedStationService.getTrackedStationStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get(':id')
  async getTrackedStationById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TrackedStationResponseDto | ErrorResponseDto> {
    try {
      const station =
        await this.trackedStationService.getTrackedStationById(id);
      return {
        success: true,
        data: station,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get tracked station: ${getErrorMessage(error)}`,
      };
    }
  }

  @Put(':id')
  async updateTrackedStation(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTrackedStationDto,
  ): Promise<TrackedStationResponseDto | ErrorResponseDto> {
    try {
      const station = await this.trackedStationService.updateTrackedStation(
        id,
        updateDto,
      );
      return {
        success: true,
        data: station,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update tracked station: ${getErrorMessage(error)}`,
      };
    }
  }

  @Delete(':id')
  async removeTrackedStation(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.trackedStationService.removeTrackedStation(id);
      return {
        success: true,
        message: 'Tracked station removed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to remove tracked station: ${getErrorMessage(error)}`,
      };
    }
  }

  @Post('initialize-defaults')
  async initializeDefaultStations(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.trackedStationService.initializeDefaultStations();
      return {
        success: true,
        message: 'Default tracked stations initialized successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to initialize default stations: ${getErrorMessage(error)}`,
      };
    }
  }
}
