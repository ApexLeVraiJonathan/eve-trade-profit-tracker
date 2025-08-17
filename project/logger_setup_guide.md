# NestJS Logger Setup Guide

## 🎯 **What We've Done**

✅ **Replaced Custom File Logging** with NestJS built-in Logger  
✅ **Added Proper Context** to identify where logs come from  
✅ **Improved Bootstrap Logging** with structured messages

## 📝 **How to Use NestJS Logger**

### **1. In Services (Recommended Pattern)**

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  async importData() {
    this.logger.log('Starting market data import');
    
    try {
      // Your logic here
      this.logger.log('Successfully imported 1,234 records');
    } catch (error) {
      this.logger.error('Failed to import market data', error.stack);
      throw error;
    }
  }

  async processData() {
    this.logger.debug('Processing data with advanced filters');
    this.logger.warn('Low liquidity detected for item 12345');
  }
}
```

### **2. Log Levels Available**

- `logger.log()` - General information (INFO level)
- `logger.error()` - Error messages with stack traces
- `logger.warn()` - Warning messages
- `logger.debug()` - Detailed debugging info
- `logger.verbose()` - Very detailed tracing

### **3. Environment Configuration**

Create `.env` variables for different environments:

```bash
# Development - Show all logs
LOG_LEVEL=debug

# Production - Only important logs
LOG_LEVEL=log

# Debugging - Show everything
LOG_LEVEL=verbose
```

### **4. Usage Examples by Module**

#### **Market Data Module**
```typescript
// Good logging practices
this.logger.log(`Imported ${records.length} market records`);
this.logger.warn(`Only ${liquidItems.length} items have sufficient liquidity`);
this.logger.error('Adam4EVE API unavailable', error.stack);
```

#### **ESI Service**
```typescript
// Rate limiting logs (keep minimal)
this.logger.debug(`ESI rate limit: ${remaining}/${limit} remaining`);
this.logger.warn('ESI rate limit approached, slowing down requests');
this.logger.error('ESI request failed after 3 retries', error.stack);
```

#### **Arbitrage Service**
```typescript
// Business logic logs
this.logger.log(`Found ${opportunities.length} arbitrage opportunities`);
this.logger.debug(`Calculating profit for route ${source} → ${destination}`);
this.logger.warn(`Low profit margin (${margin}%) for item ${itemName}`);
```

## 🔧 **Configuration for Production**

### **main.ts Configuration**
```typescript
// For production, you can configure log levels
const app = await NestFactory.create(AppModule, {
  logger: process.env.NODE_ENV === 'production' 
    ? ['error', 'warn', 'log'] 
    : ['error', 'warn', 'log', 'debug', 'verbose']
});
```

### **Environment Variables**
```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=log

# .env.development  
NODE_ENV=development
LOG_LEVEL=debug
```

## 🎯 **Migration Strategy**

### **As We Refactor Each Module:**

1. **Replace `console.log()`** → `this.logger.log()`
2. **Replace `console.error()`** → `this.logger.error(message, error.stack)`
3. **Replace `console.warn()`** → `this.logger.warn()`
4. **Add context** to logger: `new Logger(ServiceName.name)`
5. **Remove noisy logs** that don't add value in production

### **Examples of Good vs Bad Logging:**

❌ **Bad (Too Noisy)**
```typescript
console.log('Processing item...');
console.log('Item processed');
console.log('Moving to next item...');
```

✅ **Good (Meaningful)**
```typescript
this.logger.log(`Processing batch of ${items.length} items`);
this.logger.log(`Successfully processed ${successCount} items, ${errorCount} failed`);
```

❌ **Bad (No Context)**
```typescript
console.error('Request failed', error);
```

✅ **Good (Clear Context)**
```typescript
this.logger.error(`Failed to fetch market data for region ${regionId}`, error.stack);
```

## 🚀 **Benefits of NestJS Logger**

- **Consistent Formatting** - All logs have same structure
- **Context Support** - Know exactly which service logged what
- **Environment Control** - Different log levels per environment
- **Performance** - Built-in optimization for production
- **Integration** - Works seamlessly with NestJS ecosystem
- **No File Management** - No need to manage log files manually

## 📋 **Next Steps**

As we refactor each module, we'll:
1. **Add Logger to service constructors**
2. **Replace console statements**
3. **Add meaningful context to messages**
4. **Remove excessive debugging logs**
5. **Focus on business-relevant logging**

This will make debugging much easier and production monitoring more effective!
