import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';

// 🎯 GLOBAL FIX: BigInt JSON serialization
// Extend BigInt prototype to include toJSON method for JSON serialization
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function (this: bigint): string {
  return this.toString();
};

// Configure log levels based on environment variables
function getLogLevels(): ('error' | 'warn' | 'log' | 'debug' | 'verbose')[] {
  const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'log';

  switch (logLevel) {
    case 'error':
      return ['error'];
    case 'warn':
      return ['error', 'warn'];
    case 'log':
      return ['error', 'warn', 'log'];
    case 'debug':
      return ['error', 'warn', 'log', 'debug'];
    case 'verbose':
      return ['error', 'warn', 'log', 'debug', 'verbose'];
    default:
      // Production-safe default: only essential logs
      return ['error', 'warn', 'log'];
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Configure log levels based on environment
  const logLevels = getLogLevels();

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  logger.debug('Global validation pipe configured');

  // Swagger/OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('EVE Trade Profit Tracker API')
    .setDescription(
      'API for EVE Online market data analysis and arbitrage opportunities',
    )
    .setVersion('1.0')
    .addTag('reference-data', 'EVE reference data management')
    .addTag('market-data', 'Market data and daily imports')
    .addTag('tracked-stations', 'Station tracking configuration')
    .addTag('arbitrage', 'Arbitrage opportunities and calculations')
    .addTag('esi', 'EVE Swagger Interface integration')
    .addTag('scheduler', 'Automated data collection scheduling')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  logger.debug('Swagger documentation configured at /api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation available at: http://localhost:${port}/api`);
}
bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error(
    'Error starting the application:',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
