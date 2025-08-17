import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StationManagementModule } from '../station-management/station-management.module';
import { LiquidityAnalyzerService } from './liquidity-analyzer.service';
import { MarketQueryService } from './market-query.service';
import { MarketAnalyticsController } from './market-analytics.controller';

@Module({
  imports: [
    PrismaModule,
    StationManagementModule, // Need TrackedStationService from here
  ],
  controllers: [MarketAnalyticsController],
  providers: [LiquidityAnalyzerService, MarketQueryService],
  exports: [LiquidityAnalyzerService, MarketQueryService],
})
export class MarketAnalyticsModule {}
