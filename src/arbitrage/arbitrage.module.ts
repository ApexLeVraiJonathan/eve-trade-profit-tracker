import { Module } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';
import { ArbitrageController } from './arbitrage.controller';
import { EsiModule } from '../esi/esi.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [EsiModule, MarketDataModule],
  controllers: [ArbitrageController],
  providers: [ArbitrageService],
  exports: [ArbitrageService],
})
export class ArbitrageModule {}
