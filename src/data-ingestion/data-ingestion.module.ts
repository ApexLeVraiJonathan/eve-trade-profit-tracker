import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StationManagementModule } from '../station-management/station-management.module';
import { MarketDataImportService } from './market-data-import.service';
import { DailyDataFetcherService } from './daily-data-fetcher.service';
import { DailyDataSchedulerService } from './daily-data-scheduler.service';
import { DailyDataFetcherController } from './daily-data-fetcher.controller';
import { DailyDataSchedulerController } from './daily-data-scheduler.controller';

@Module({
  imports: [
    PrismaModule,
    StationManagementModule, // Need TrackedStationService
  ],
  controllers: [DailyDataFetcherController, DailyDataSchedulerController],
  providers: [
    MarketDataImportService,
    DailyDataFetcherService,
    DailyDataSchedulerService,
  ],
  exports: [
    MarketDataImportService,
    DailyDataFetcherService,
    DailyDataSchedulerService,
  ],
})
export class DataIngestionModule {}
