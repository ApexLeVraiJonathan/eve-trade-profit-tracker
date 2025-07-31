import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';
import { MarketDataModule } from './market-data/market-data.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ReferenceDataModule,
    MarketDataModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
