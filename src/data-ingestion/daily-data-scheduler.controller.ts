import { Controller, Get, Post, Put, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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

@ApiTags('scheduler')
@Controller('scheduler')
export class DailyDataSchedulerController {
  private readonly logger = new Logger(DailyDataSchedulerController.name);

  constructor(
    private readonly dailyDataSchedulerService: DailyDataSchedulerService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get scheduler status',
    description:
      'Check the current status of the automated daily data collection scheduler',
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduler status retrieved successfully',
    type: Object,
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to get scheduler status',
  })
  getSchedulerStatus(): SchedulerStatusDto | ErrorResponseDto {
    try {
      this.logger.debug('Getting scheduler status');
      const status = this.dailyDataSchedulerService.getSchedulerStatus();

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error('Failed to get scheduler status', error);
      return {
        success: false,
        message: `Failed to get scheduler status: ${getErrorMessage(error)}`,
      };
    }
  }

  @Post('trigger')
  @ApiOperation({
    summary: 'Manually trigger data fetch',
    description:
      'Force an immediate data collection run (for testing or emergency use)',
  })
  @ApiResponse({
    status: 200,
    description: 'Manual fetch triggered successfully',
    type: Object,
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to trigger manual fetch',
  })
  triggerManualFetch(): ManualTriggerDto | ErrorResponseDto {
    try {
      this.logger.log('Triggering manual data fetch');
      const result = this.dailyDataSchedulerService.triggerManualFetch();
      return result;
    } catch (error) {
      this.logger.error('Failed to trigger manual fetch', error);
      return {
        success: false,
        message: `Failed to trigger manual fetch: ${getErrorMessage(error)}`,
      };
    }
  }

  @Put('enable')
  @ApiOperation({
    summary: 'Enable automatic scheduling',
    description: 'Turn on the daily automated data collection at 6 AM UTC',
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduling enabled successfully',
    type: Object,
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to enable scheduling',
  })
  enableScheduling(): SchedulerConfigDto | ErrorResponseDto {
    try {
      this.logger.log('Enabling automatic scheduling');
      const result = this.dailyDataSchedulerService.setSchedulingEnabled(true);
      return result;
    } catch (error) {
      this.logger.error('Failed to enable scheduling', error);
      return {
        success: false,
        message: `Failed to enable scheduling: ${getErrorMessage(error)}`,
      };
    }
  }

  @Put('disable')
  @ApiOperation({
    summary: 'Disable automatic scheduling',
    description: 'Turn off the daily automated data collection',
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduling disabled successfully',
    type: Object,
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to disable scheduling',
  })
  disableScheduling(): SchedulerConfigDto | ErrorResponseDto {
    try {
      this.logger.log('Disabling automatic scheduling');
      const result = this.dailyDataSchedulerService.setSchedulingEnabled(false);
      return result;
    } catch (error) {
      this.logger.error('Failed to disable scheduling', error);
      return {
        success: false,
        message: `Failed to disable scheduling: ${getErrorMessage(error)}`,
      };
    }
  }
}
