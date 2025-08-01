import { Module } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';
import { ArbitrageController } from './arbitrage.controller';
import { EsiModule } from '../esi/esi.module';

@Module({
  imports: [EsiModule],
  controllers: [ArbitrageController],
  providers: [ArbitrageService],
  exports: [ArbitrageService],
})
export class ArbitrageModule {}
