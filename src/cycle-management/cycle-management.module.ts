import { Module } from '@nestjs/common';
import { CycleManagementService } from './cycle-management.service';
import { CycleManagementController } from './cycle-management.controller';
import { ArbitrageModule } from '../arbitrage/arbitrage.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ArbitrageModule, PrismaModule],
  controllers: [CycleManagementController],
  providers: [CycleManagementService],
  exports: [CycleManagementService],
})
export class CycleManagementModule {}
