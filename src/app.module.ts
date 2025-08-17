import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';
import { MarketAnalyticsModule } from './market-analytics/market-analytics.module';
import { StationManagementModule } from './station-management/station-management.module';
import { DataIngestionModule } from './data-ingestion/data-ingestion.module';
import { EsiModule } from './esi/esi.module';
import { ArbitrageModule } from './arbitrage/arbitrage.module';
import { CycleManagementModule } from './cycle-management/cycle-management.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ReferenceDataModule,
    MarketAnalyticsModule,
    StationManagementModule,
    DataIngestionModule,
    EsiModule,
    ArbitrageModule,
    CycleManagementModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
