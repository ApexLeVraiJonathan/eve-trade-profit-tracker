import { Module } from '@nestjs/common';
import { CycleManagementService } from './cycle-management.service';
import { CycleManagementController } from './cycle-management.controller';
import { ArbitrageModule } from '../arbitrage/arbitrage.module';

@Module({
  imports: [ArbitrageModule],
  controllers: [CycleManagementController],
  providers: [CycleManagementService],
  exports: [CycleManagementService],
})
export class CycleManagementModule {}
