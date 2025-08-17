import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackedStationService } from './tracked-station.service';
import { TrackedStationController } from './tracked-station.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TrackedStationController],
  providers: [TrackedStationService],
  exports: [TrackedStationService],
})
export class StationManagementModule {}
