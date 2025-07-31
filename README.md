# 🚀 EVE Trade Profit Tracker

A **production-ready NestJS application** for tracking EVE Online market data with **automated daily updates** and comprehensive trade opportunity analysis.

## 🌟 **Key Features**

- **🤖 Built-in Scheduler**: Automatic daily data fetching (no external cron jobs needed)
- **📊 Smart Data Filtering**: Only tracks your selected stations (70%+ storage efficiency)
- **🔄 Gap Recovery**: Automatically catches up after downtime (up to 16 days)
- **⚡ Real-time APIs**: Complete REST API for all market data operations
- **🎯 Production Ready**: Robust error handling, logging, and monitoring
- **🏪 Station Management**: Focus on major trade hubs (Amarr, Dodixie, Hek, Rens)
- **📈 Historical Data**: Build a database of daily market trends for analysis

## 🚀 **Quick Start**

### 1. Prerequisites

- **PostgreSQL** database
- **Node.js 18+** and **pnpm**
- **EVE Online** market data interest 😉

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Setup Database

```bash
# Copy environment file and configure DATABASE_URL
cp .env.example .env

# Edit .env with your PostgreSQL connection string
# DATABASE_URL="postgresql://username:password@localhost:5432/eve_trades"

# Run database migrations
pnpm dlx prisma migrate dev
```

### 4. Bootstrap Reference Data

```bash
# Start the application first
pnpm run start:dev

# In another terminal, bootstrap reference data (regions, stations, item types)
curl -X POST http://localhost:3000/reference-data/bootstrap
```

### 5. Initialize Tracked Stations

```bash
# Add the 4 major trade hubs automatically
curl -X POST http://localhost:3000/tracked-stations/initialize-defaults
```

### 6. Import Initial Market Data

```bash
# Fetch all missing daily data automatically
curl -X POST http://localhost:3000/daily-data/fetch
```

**🎉 That's it! Your EVE market tracker is now running with automatic daily updates!**

## 🤖 **Automatic Scheduling**

The application includes a **built-in cron scheduler** that runs daily at **6:00 AM UTC**:

```bash
# Check scheduler status
curl http://localhost:3000/scheduler/status

# Response shows when it last ran and next run time
{
  "isEnabled": true,
  "lastRunTime": "2025-07-31T06:00:01.234Z",
  "nextRunTime": "2025-08-01T06:00:00.000Z",
  "lastRunResult": "✅ SUCCESS: Successfully imported 1 daily files with 11249 total records"
}

# Manually trigger for testing
curl -X POST http://localhost:3000/scheduler/trigger

# Disable in development
ENABLE_SCHEDULER=false pnpm run start:dev
```

## 📋 **API Endpoints Overview**

### **Reference Data Management**

```bash
GET    /reference-data/stats              # View reference data counts
POST   /reference-data/bootstrap          # Smart deployment setup
```

### **Tracked Station Management**

```bash
GET    /tracked-stations                  # List all tracked stations
POST   /tracked-stations                  # Add new tracked station
DELETE /tracked-stations/:id              # Remove tracked station
```

### **Market Data Operations**

```bash
GET    /market-data/stats                 # Market data statistics
GET    /market-data/query                 # Query with filters
POST   /daily-data/fetch                  # Smart fetch missing files
```

### **Scheduler Management**

```bash
GET    /scheduler/status                  # Current scheduler status
POST   /scheduler/trigger                 # Manual trigger
PUT    /scheduler/enable                  # Enable scheduling
PUT    /scheduler/disable                 # Disable scheduling
```

## 🏗️ **Architecture**

### **Database Schema**

- **Reference Tables**: Regions, Solar Systems, Stations, Item Types
- **Tracked Stations**: Your selected stations to monitor
- **Market Data**: Daily trade data with proper foreign keys
- **Optimized Indexes**: Fast queries for analysis

### **Services**

- **Reference Data Service**: Manages EVE static data
- **Market Data Service**: Handles trade data import/query
- **Daily Fetcher Service**: Smart downloading from Adam4EVE
- **Scheduler Service**: Built-in cron job management

### **Data Pipeline**

1. **6 AM UTC Daily**: Scheduler automatically triggers
2. **Gap Detection**: Compares DB vs available files
3. **Smart Download**: Only gets missing files
4. **Filtered Import**: Only stores tracked station data
5. **Cleanup**: Removes temporary files

## 🚢 **Production Deployment**

### **Environment Variables**

```bash
# Required
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Optional
ENABLE_SCHEDULER=true        # Enable automatic daily scheduling
PORT=3000                    # Application port
```

### **Docker Deployment**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install
COPY . .
RUN pnpm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### **PM2 Deployment**

```bash
# Build and start
pnpm run build
pm2 start dist/main.js --name "eve-tracker"

# Monitor
pm2 logs eve-tracker
pm2 monit
```

## 📊 **Current Capabilities**

- **📈 22,397+ Market Records** tracked across major trade hubs
- **🏪 4 Major Trade Hubs** (Amarr, Dodixie, Hek, Rens) monitored
- **⚡ 70%+ Storage Efficiency** (only relevant stations)
- **🔄 Daily Automation** with zero external dependencies
- **📅 Historical Data** back to your first import
- **🎯 Production Ready** with comprehensive error handling

## 🛠️ **Development**

### **Tech Stack**

- **NestJS** - Progressive Node.js framework
- **Prisma ORM** - Database toolkit with PostgreSQL
- **TypeScript** - Full type safety
- **@nestjs/schedule** - Built-in cron jobs
- **csv-parse** - Efficient CSV processing

### **Project Structure**

```
src/
├── reference-data/     # EVE static data management
├── market-data/        # Trade data and scheduling
├── prisma/            # Database connection
└── common/            # Shared utilities
```

### **Development Commands**

```bash
# Start with file watching
pnpm run start:dev

# Database operations
pnpm dlx prisma studio              # Visual database browser
pnpm dlx prisma migrate dev         # Create new migration
pnpm dlx prisma generate           # Regenerate client

# Code quality
pnpm run lint                      # ESLint
pnpm run format                    # Prettier
pnpm run test                      # Jest tests
```

## 📚 **Documentation**

- **[SCHEDULER.md](SCHEDULER.md)** - Complete scheduler documentation
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide
- **[project_progress.md](project_progress.md)** - Development progress tracking

## 🎯 **Future Enhancements**

- **📈 Price Trend Analysis** - Calculate profit opportunities
- **📊 Data Visualization** - Charts and graphs for market trends
- **⚠️ Alert System** - Notifications for price changes
- **🔗 ESI Integration** - Real-time EVE Online API data

## 🤝 **Contributing**

This project serves as a **learning platform for NestJS** and **EVE Online market analysis**. Feel free to:

1. **Fork the repository**
2. **Add new features** (profit calculators, trend analysis, etc.)
3. **Improve documentation**
4. **Submit pull requests**

## 📄 **License**

MIT License - feel free to use this for your own EVE market analysis projects!

---

**Built with ❤️ for the EVE Online trading community**

_Fly safe, trade smart, profit wisely! o7_
