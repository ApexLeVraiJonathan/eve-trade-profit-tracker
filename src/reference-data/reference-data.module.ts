import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EsiModule } from '../esi/esi.module';
import { ReferenceDataService } from './reference-data.service';
import { ReferenceDataController } from './reference-data.controller';
import { Adam4EveFetcherService } from './adam4eve-fetcher.service';

@Module({
  imports: [PrismaModule, EsiModule],
  controllers: [ReferenceDataController],
  providers: [ReferenceDataService, Adam4EveFetcherService],
  exports: [ReferenceDataService, Adam4EveFetcherService],
})
export class ReferenceDataModule {}
