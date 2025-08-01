import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EsiService } from './esi.service';
import { EsiController } from './esi.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [EsiController],
  providers: [EsiService],
  exports: [EsiService],
})
export class EsiModule {}
