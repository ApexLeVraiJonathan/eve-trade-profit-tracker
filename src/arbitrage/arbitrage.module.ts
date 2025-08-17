import { Module } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';
import { ArbitrageController } from './arbitrage.controller';
import { EsiModule } from '../esi/esi.module';
import { DataIngestionModule } from '../data-ingestion/data-ingestion.module';
import { MarketAnalyticsModule } from '../market-analytics/market-analytics.module';

@Module({
  imports: [EsiModule, DataIngestionModule, MarketAnalyticsModule],
  controllers: [ArbitrageController],
  providers: [ArbitrageService],
  exports: [ArbitrageService],
})
export class ArbitrageModule {}
