import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';
import { MarketDataModule } from './market-data/market-data.module';
import { EsiModule } from './esi/esi.module';
import { ArbitrageModule } from './arbitrage/arbitrage.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ReferenceDataModule,
    MarketDataModule,
    EsiModule,
    ArbitrageModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
