import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { MarketDataImportService } from './market-data-import.service';
import { MarketDataImportResultDto } from '../common/dto/market-data.dto';
import { ErrorResponseDto } from '../reference-data/dto/reference-data.dto';
import { getErrorMessage } from '../common/interfaces/error.interface';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('data-ingestion')
@Controller('market-data-import')
export class MarketDataImportController {
  private readonly logger = new Logger(MarketDataImportController.name);

  constructor(
    private readonly marketDataImportService: MarketDataImportService,
  ) {}

  @Post('import')
  @ApiOperation({
    summary: 'Import market data from file',
    description: 'Import EVE market data from a CSV file into the database',
  })
  @ApiBody({
    description: 'File path to import',
    schema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the CSV file to import',
          example: '/path/to/marketOrderTrades_daily_2025-07-29.csv',
        },
      },
      required: ['filePath'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Market data imported successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file path or import failed',
  })
  async importMarketDataFromFile(
    @Body() body: { filePath: string },
  ): Promise<MarketDataImportResultDto | ErrorResponseDto> {
    try {
      this.logger.log(`Starting import from file: ${body.filePath}`);
      const stats = await this.marketDataImportService.importMarketDataFromFile(
        body.filePath,
      );

      const duration = `${stats.endTime.getTime() - stats.startTime.getTime()}ms`;

      return {
        success: true,
        message: 'Market data import completed successfully',
        data: {
          totalProcessed: stats.totalProcessed,
          imported: stats.imported,
          skipped: stats.skipped,
          errors: stats.errors,
          trackedStationsFound: stats.trackedStationsFound,
          importDuration: duration,
        },
      };
    } catch (error) {
      this.logger.error(`Market data import failed: ${body.filePath}`, error);
      return {
        success: false,
        message: `Market data import failed: ${getErrorMessage(error)}`,
      };
    }
  }

  @Post('import-sample')
  @ApiOperation({
    summary: 'Import sample market data',
    description:
      'Import the sample market data file from the doc/ folder for testing',
  })
  @ApiResponse({
    status: 201,
    description: 'Sample data imported successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Sample file not found or import failed',
  })
  async importSampleData(): Promise<
    MarketDataImportResultDto | ErrorResponseDto
  > {
    // Import the sample data file from doc folder
    const sampleFilePath = path.resolve(
      'doc',
      'marketOrderTrades_daily_2025-07-29.csv',
    );

    if (!fs.existsSync(sampleFilePath)) {
      this.logger.error(`Sample data file not found: ${sampleFilePath}`);
      return {
        success: false,
        message: 'Sample data file not found',
      };
    }

    try {
      this.logger.log('Starting sample data import');
      const stats =
        await this.marketDataImportService.importMarketDataFromFile(
          sampleFilePath,
        );

      const duration = `${stats.endTime.getTime() - stats.startTime.getTime()}ms`;

      return {
        success: true,
        message: 'Sample market data import completed successfully',
        data: {
          totalProcessed: stats.totalProcessed,
          imported: stats.imported,
          skipped: stats.skipped,
          errors: stats.errors,
          trackedStationsFound: stats.trackedStationsFound,
          importDuration: duration,
        },
      };
    } catch (error) {
      this.logger.error('Sample data import failed', error);
      return {
        success: false,
        message: `Sample data import failed: ${getErrorMessage(error)}`,
      };
    }
  }
}
