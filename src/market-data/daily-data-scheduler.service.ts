import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DailyDataFetcherService } from './daily-data-fetcher.service';
import { getErrorMessage } from '../common/interfaces/error.interface';

@Injectable()
export class DailyDataSchedulerService {
  private readonly logger = new Logger(DailyDataSchedulerService.name);
  private isProcessing = false;
  private lastRunTime: Date | null = null;
  private lastRunResult: string | null = null;

  constructor(private dailyDataFetcherService: DailyDataFetcherService) {
    this.logger.log('Daily Data Scheduler initialized');
  }

  // Run every day at 6:00 AM (gives Adam4EVE time after their 5:30 AM processing)
  // Cron format: second minute hour day month dayOfWeek
  @Cron('0 0 6 * * *', {
    name: 'daily-market-data-fetch',
    timeZone: 'UTC', // Use UTC to avoid timezone issues
  })
  async handleDailyDataFetch() {
    // Check if ENABLE_SCHEDULER environment variable is set
    const isSchedulingEnabled = process.env.ENABLE_SCHEDULER !== 'false';

    if (!isSchedulingEnabled) {
      this.logger.log('Scheduled fetch skipped - ENABLE_SCHEDULER=false');
      return;
    }

    if (this.isProcessing) {
      this.logger.warn(
        'Previous daily fetch still in progress, skipping this run',
      );
      return;
    }

    this.isProcessing = true;
    this.lastRunTime = new Date();

    this.logger.log('🤖 Starting scheduled daily market data fetch...');

    try {
      const result = await this.dailyDataFetcherService.fetchMissingDailyData();

      if (result.success) {
        this.lastRunResult = `✅ SUCCESS: ${result.message}`;
        this.logger.log(
          `✅ Scheduled fetch completed successfully: ${result.message}`,
        );

        // Log detailed statistics
        this.logger.log(`📊 Import Statistics:
- Files to fetch: ${result.data.filesToFetch.length}
- Files downloaded: ${result.data.filesDownloaded.length}
- Files imported: ${result.data.filesImported.length}
- Files failed: ${result.data.filesFailed.length}
- Total records imported: ${result.data.totalRecordsImported}
- Duration: ${result.data.fetchDuration}`);
      } else {
        this.lastRunResult = `❌ FAILED: ${result.message}`;
        this.logger.error(`❌ Scheduled fetch failed: ${result.message}`);
      }
    } catch (error) {
      this.lastRunResult = `💥 ERROR: ${getErrorMessage(error)}`;
      this.logger.error(
        `💥 Scheduled fetch encountered error: ${getErrorMessage(error)}`,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  // Manual trigger for testing or one-off runs
  async triggerManualFetch(): Promise<{
    success: boolean;
    message: string;
    triggered: boolean;
  }> {
    if (this.isProcessing) {
      return {
        success: false,
        message: 'Daily fetch is already in progress',
        triggered: false,
      };
    }

    this.logger.log('🔧 Manual daily fetch triggered');

    // Run the same logic as the scheduled task
    this.handleDailyDataFetch();

    return {
      success: true,
      message: 'Manual daily fetch triggered successfully',
      triggered: true,
    };
  }

  // Get scheduler status and statistics
  getSchedulerStatus() {
    return {
      isProcessing: this.isProcessing,
      isEnabled: process.env.ENABLE_SCHEDULER !== 'false',
      lastRunTime: this.lastRunTime?.toISOString() || null,
      lastRunResult: this.lastRunResult,
      nextRunTime: this.getNextRunTime(),
      cronExpression: '0 0 6 * * *', // 6:00 AM daily
      timezone: 'UTC',
    };
  }

  private getNextRunTime(): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    tomorrow.setUTCHours(6, 0, 0, 0); // 6:00 AM UTC

    // If it's before 6 AM today, next run is today at 6 AM
    const todayAt6AM = new Date(now);
    todayAt6AM.setUTCHours(6, 0, 0, 0);

    if (now < todayAt6AM) {
      return todayAt6AM.toISOString();
    }

    return tomorrow.toISOString();
  }

  // Enable/disable scheduling at runtime
  setSchedulingEnabled(enabled: boolean) {
    process.env.ENABLE_SCHEDULER = enabled ? 'true' : 'false';
    this.logger.log(`Scheduling ${enabled ? 'ENABLED' : 'DISABLED'}`);

    return {
      success: true,
      message: `Scheduling ${enabled ? 'enabled' : 'disabled'}`,
      enabled,
    };
  }
}
