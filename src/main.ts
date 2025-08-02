import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

// 🎯 GLOBAL FIX: BigInt JSON serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Custom logger that writes to both console and file
class FileLogger {
  private logFile: string;

  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logsDir, `debug-${timestamp}.log`);

    console.log(`📝 Debug logs will be saved to: ${this.logFile}`);
  }

  log(message: string, context?: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] LOG [${context || 'Application'}] ${message}\n`;

    // Write to console
    console.log(message);

    // Write to file
    fs.appendFileSync(this.logFile, logEntry);
  }

  error(message: string, trace?: string, context?: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ERROR [${context || 'Application'}] ${message}${trace ? `\n${trace}` : ''}\n`;

    // Write to console
    console.error(message);

    // Write to file
    fs.appendFileSync(this.logFile, logEntry);
  }

  warn(message: string, context?: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] WARN [${context || 'Application'}] ${message}\n`;

    // Write to console
    console.warn(message);

    // Write to file
    fs.appendFileSync(this.logFile, logEntry);
  }

  debug(message: string, context?: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] DEBUG [${context || 'Application'}] ${message}\n`;

    // Write to console
    console.debug(message);

    // Write to file
    fs.appendFileSync(this.logFile, logEntry);
  }

  verbose(message: string, context?: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] VERBOSE [${context || 'Application'}] ${message}\n`;

    // Write to console
    console.log(message);

    // Write to file
    fs.appendFileSync(this.logFile, logEntry);
  }
}

async function bootstrap() {
  const fileLogger = new FileLogger();

  const app = await NestFactory.create(AppModule, {
    logger: fileLogger,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error) => {
  console.error('Error starting the application:', error);
  process.exit(1);
});
