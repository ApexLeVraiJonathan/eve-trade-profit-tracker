import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackedStationService } from './tracked-station.service';
import { MarketDataService } from './market-data.service';
import { DailyDataFetcherService } from './daily-data-fetcher.service';
import { DailyDataSchedulerService } from './daily-data-scheduler.service';
import { LiquidityAnalyzerService } from './liquidity-analyzer.service';
import { TrackedStationController } from './tracked-station.controller';
import { MarketDataController } from './market-data.controller';
import { DailyDataFetcherController } from './daily-data-fetcher.controller';
import { DailyDataSchedulerController } from './daily-data-scheduler.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    TrackedStationController,
    MarketDataController,
    DailyDataFetcherController,
    DailyDataSchedulerController,
  ],
  providers: [
    TrackedStationService,
    MarketDataService,
    DailyDataFetcherService,
    DailyDataSchedulerService,
    LiquidityAnalyzerService,
  ],
  exports: [
    TrackedStationService,
    MarketDataService,
    DailyDataFetcherService,
    DailyDataSchedulerService,
    LiquidityAnalyzerService,
  ],
})
export class MarketDataModule {}
