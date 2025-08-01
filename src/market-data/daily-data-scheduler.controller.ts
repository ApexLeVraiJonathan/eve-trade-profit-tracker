import { Controller, Get, Post, Put, Body } from '@nestjs/common';
import { DailyDataSchedulerService } from './daily-data-scheduler.service';
import { ErrorResponseDto } from '../reference-data/dto/reference-data.dto';
import { getErrorMessage } from '../common/interfaces/error.interface';

export interface SchedulerStatusDto {
  success: boolean;
  data: {
    isProcessing: boolean;
    isEnabled: boolean;
    lastRunTime: string | null;
    lastRunResult: string | null;
    nextRunTime: string;
    cronExpression: string;
    timezone: string;
  };
}

export interface ManualTriggerDto {
  success: boolean;
  message: string;
  triggered: boolean;
}

export interface SchedulerConfigDto {
  success: boolean;
  message: string;
  enabled: boolean;
}

@Controller('scheduler')
export class DailyDataSchedulerController {
  constructor(
    private readonly dailyDataSchedulerService: DailyDataSchedulerService,
  ) {}

  @Get('status')
  getSchedulerStatus(): SchedulerStatusDto | ErrorResponseDto {
    try {
      const status = this.dailyDataSchedulerService.getSchedulerStatus();

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get scheduler status: ${getErrorMessage(error)}`,
      };
    }
  }

  @Post('trigger')
  triggerManualFetch(): ManualTriggerDto | ErrorResponseDto {
    try {
      const result = this.dailyDataSchedulerService.triggerManualFetch();
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Failed to trigger manual fetch: ${getErrorMessage(error)}`,
      };
    }
  }

  @Put('enable')
  enableScheduling(): SchedulerConfigDto | ErrorResponseDto {
    try {
      const result = this.dailyDataSchedulerService.setSchedulingEnabled(true);
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Failed to enable scheduling: ${getErrorMessage(error)}`,
      };
    }
  }

  @Put('disable')
  disableScheduling(): SchedulerConfigDto | ErrorResponseDto {
    try {
      const result = this.dailyDataSchedulerService.setSchedulingEnabled(false);
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Failed to disable scheduling: ${getErrorMessage(error)}`,
      };
    }
  }
}
