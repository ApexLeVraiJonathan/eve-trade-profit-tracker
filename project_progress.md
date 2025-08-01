# EVE Trade Profit Tracker - Project Progress

## Project Overview

Building a NestJS application to import, store, and analyze EVE Online market data from Adam4EVE platform with proper reference data normalization.

## Current Status: 🟢 Planning Phase 5 - ESI Real-time Price Collection

### ✅ Completed Tasks

1. **Project Setup**
   - [x] NestJS project initialized
   - [x] Prisma ORM configured with PostgreSQL
   - [x] Basic project structure in place
   - [x] Dependencies installed (NestJS, Prisma, TypeScript)

2. **Data Analysis & Schema Design**
   - [x] Analyzed Adam4EVE reference data structure
   - [x] Designed normalized Prisma schema with proper relationships
   - [x] Set up proper foreign key relationships

### 🔄 Current Phase: Reference Data Foundation

#### 📊 Data Analysis (Adam4EVE)

**Reference Data Available** (from `doc/` folder):

- `type_ids.csv` - Item types (`typeID;typeName;published`) - 2MB
- `region_ids.csv` - Regions (`regionID;regionName`) - 115 lines
- `npcStation_ids.csv` - NPC Stations (`stationID;solarSystemID;stationName`) - 5,156 lines
- `solarSystem_ids.csv` - Solar Systems (`solarSystemID;solarSystemName;regionID`) - 8,439 lines

**Market Data**: `marketOrderTrades_daily_2025-07-29.csv` (39,508 records)

```
location_id;region_id;type_id;is_buy_order;has_gone;scanDate;amount;high;low;avg;orderNum;iskValue
```

**Adam4EVE Reference Source**: [https://static.adam4eve.eu/IDs/](https://static.adam4eve.eu/IDs/)

- Reference data updated daily at 5AM
- Files available in both CSV and TXT formats

**Database Schema Design**:

```
Region (1) -> (N) SolarSystem (1) -> (N) Station
ItemType (1) -> (N) MarketOrderTrade (N) -> (1) Region
         (N) -> (1) Station (optional, for NPC stations)
```

### 🎯 Next Steps (Priority Order)

#### Phase 1: Reference Data Foundation ✅ COMPLETED

- [x] Design Prisma schema for reference data (regions, solar systems, stations, item types)
- [x] Run Prisma migration for reference tables
- [x] Create NestJS service to import reference data from CSV
- [x] Import initial reference data from `doc/` folder
  - **113 regions** imported (98% success rate)
  - **8,437 solar systems** imported (99.9% success rate)
  - **5,154 NPC stations** imported (99.9% success rate)
  - **50,243 item types** imported (much larger than expected!)
- [x] Create Adam4EVE fetcher service for fresh reference data from https://static.adam4eve.eu/IDs/
  - **✅ Availability checker**: Validates all files are accessible before download
  - **✅ Smart downloader**: Downloads all 4 reference files to temp directory
  - **✅ Auto-import**: Uses existing import service with fresh data
  - **✅ Cleanup**: Removes temp files after import
  - **✅ Diff tracking**: Shows exactly what changed (new regions, items, etc.)

#### Phase 2: Market Data Schema ✅ COMPLETED

- [x] Finalize market data schema with proper foreign keys
- [x] Run migration for market order trade table
- [x] Test referential integrity
- [x] Create TrackedStation model for selective monitoring
- [x] Create market data import service with filtering
- [x] Initialize default tracked stations (4 major trade hubs)
- [x] Successfully import sample data (11,248 records for tracked stations only)
- [x] Create comprehensive DTOs and interfaces with proper TypeScript typing
- [x] Build API endpoints for tracked station and market data management

#### Phase 3: Data Access Layer ✅ COMPLETED

- [x] Create market data service with proper joins
- [x] Implement common queries (by region, item type, date ranges)
- [x] Add data aggregation functions
- [x] Create REST API endpoints
- [x] CSV parser for Adam4EVE market data format (✅ working perfectly)
- [x] Data validation and deduplication (✅ upsert strategy implemented)
- [x] Import service for daily market data (✅ with smart filtering)
- [x] Error handling and logging (✅ comprehensive error tracking)

#### Phase 4: Automated Daily Data Pipeline ✅ COMPLETED

- [x] **Smart Daily Data Fetcher** - Automatically identifies and downloads missing files
- [x] **Gap Detection** - Compares DB vs available files to find missing dates
- [x] **Intelligent Processing** - Only downloads what's needed (max 16 days back)
- [x] **Robust Error Handling** - Handles missing files, network issues, and partial failures
- [x] **Dev/Prod Ready** - Works whether system was down or running continuously
- [x] **Real-time Status** - Monitor how up-to-date your data is
- [x] **File Availability Check** - See what's available on Adam4EVE before fetching
- [x] **🤖 Internal Cron Scheduler** - Built-in scheduling runs daily at 6 AM UTC
- [x] **Environment Control** - Enable/disable scheduling with ENABLE_SCHEDULER env var
- [x] **Manual Triggers** - Force immediate fetch via API for testing/emergency
- [x] **Scheduler Management** - Enable/disable, status monitoring, and detailed logging

#### Phase 5A: MVP Arbitrage System 🎯 CURRENT PHASE

**Goal**: Get basic arbitrage detection working with essential features only

- [ ] **ESI Basic Integration** ⭐ CORE
  - [ ] Set up simple ESI market data fetching (`/markets/{region_id}/orders/`)
  - [ ] Create basic ESI service (no auth needed for public market data)
  - [ ] Test connectivity and basic price retrieval for tracked hubs
  - [ ] Handle rate limiting (simple approach: 1 request/second to start)

- [ ] **Essential Database Changes** ⭐ CORE
  - [ ] Add volume field to ItemType model (just volume, not packaged_volume)
  - [ ] Create simple MarketPrice table for current buy/sell orders
  - [ ] Run Prisma migration for basic schema
  - [ ] No historical tracking yet (keep it simple)

- [ ] **Item Volume Data** ⭐ CORE
  - [ ] Fetch volume (m³) for tracked items from ESI universe endpoints
  - [ ] Populate ItemType.volume field for calculation purposes
  - [ ] Focus only on items we're already tracking (not all 50k items)

- [ ] **Basic Arbitrage Engine** ⭐ CORE
  - [ ] Cross-hub price comparison for tracked items
  - [ ] Basic profit calculation: (sell_price - buy_price) - taxes
  - [ ] ISK/m³ efficiency calculation for transport optimization
  - [ ] Simple ranking by profit potential

- [ ] **Core Tax Calculations** ⭐ CORE
  - [ ] Implement basic 2.25% sales tax and broker fees
  - [ ] No skill bonuses or standings yet (assume worst case)
  - [ ] Simple, conservative profit estimates

- [ ] **Basic API Endpoints** ⭐ CORE
  - [ ] GET /arbitrage/opportunities - List current arbitrage chances
  - [ ] GET /arbitrage/calculate - Calculate profit for specific item/route
  - [ ] Simple JSON responses, no fancy filtering yet

#### Phase 5B: Enhanced Features 📈 NICE-TO-HAVE

**Goal**: Improve the basic system with better data and features

- [ ] **Historical Price Tracking** 🔧 ENHANCEMENT
  - [ ] Create PriceHistory table for trend analysis
  - [ ] Implement 4x daily price updates (vs on-demand)
  - [ ] 15-day retention policy for storage optimization
  - [ ] Price change alerts and notifications

- [ ] **Advanced Calculations** 🔧 ENHANCEMENT
  - [ ] Skill-based tax reductions (Accounting, Broker Relations)
  - [ ] Standing-based fee adjustments
  - [ ] Multiple cargo ship optimizations (not just freighter)
  - [ ] Regional import/export fees

- [ ] **Historical Buy Order Strategy** 🔧 ENHANCEMENT
  - [ ] Analyze historical market data to identify commonly traded items
  - [ ] Calculate optimal buy order prices based on historical sell patterns
  - [ ] Implement buy order placement recommendations for Jita
  - [ ] Track success rates of historical buy order strategies
  - [ ] Smart buy order timing based on market cycles and volume patterns

- [ ] **ESI Performance Optimization** 🔧 ENHANCEMENT
  - [ ] Register ESI application with CCP for authenticated access
  - [ ] Implement OAuth2 flow for ESI authentication
  - [ ] Upgrade from 100 req/sec (public) to 400+ req/sec (authenticated)
  - [ ] Add ESI application management and token refresh
  - [ ] Implement ESI error handling for 4xx/5xx responses

- [ ] **Risk Assessment** 🔧 ENHANCEMENT
  - [ ] Price volatility scoring
  - [ ] Market depth analysis (how much volume available)
  - [ ] Competition level monitoring
  - [ ] Historical success rate tracking

- [ ] **Advanced API Features** 🔧 ENHANCEMENT
  - [ ] Complex filtering and sorting options
  - [ ] Portfolio optimization recommendations
  - [ ] Bulk route calculation
  - [ ] Export to CSV/Excel functionality

#### Phase 5C: Character Integration 👨‍🚀 FUTURE

**Goal**: Automate tracking with character data (much later)

- [ ] **ESI Character Auth** 🚀 FUTURE
  - [ ] OAuth2 implementation for character access
  - [ ] Token management and refresh handling
  - [ ] Multiple character support

- [ ] **Automated Tracking** 🚀 FUTURE
  - [ ] Character asset and wallet monitoring
  - [ ] Transaction history import
  - [ ] Operation lifecycle tracking (planned → executed → completed)
  - [ ] Profit/loss analysis per operation

#### Phase 6: Business Intelligence & Automation 🤖 FUTURE

**Goal**: Automated decision making and advanced business intelligence

_Note: This phase builds on completed Phase 5A-5C (MVP + Enhanced Features + Character Integration)_

- [ ] **Automated Trading Strategies**
  - [ ] Rule-based trading automation (with safeguards)
  - [ ] Automated order placement and adjustment
  - [ ] Smart position sizing based on capital allocation
  - [ ] Automated stop-loss and profit-taking rules

- [ ] **Advanced Market Intelligence**
  - [ ] Multi-timeframe trend analysis (hourly, daily, weekly)
  - [ ] Market cycle detection and timing
  - [ ] Cross-correlation analysis between different items/regions
  - [ ] Seasonal pattern recognition and forecasting

- [ ] **Performance Analytics & Optimization**
  - [ ] Trading performance benchmarking and scoring
  - [ ] Strategy effectiveness analysis and recommendations
  - [ ] Capital efficiency optimization
  - [ ] Risk-adjusted return calculations (Sharpe ratio, etc.)

- [ ] **Predictive Analytics**
  - [ ] Price movement prediction models
  - [ ] Demand forecasting for different trade routes
  - [ ] Market volatility prediction
  - [ ] Optimal timing recommendations for trades

- [ ] **Business Process Automation**
  - [ ] Automated reporting and performance summaries
  - [ ] Smart alerts and notifications based on conditions
  - [ ] Automated backup and recovery procedures
  - [ ] Integration with external tools and APIs

#### Phase 7: User Interface & Visualization 📊 FUTURE

**Goal**: Professional dashboards and user experience for traders

- [ ] **Web Dashboard Development**
  - [ ] React/Next.js frontend development
  - [ ] Real-time market data visualization
  - [ ] Interactive arbitrage opportunity explorer
  - [ ] Character and operation management interface

- [ ] **Advanced Visualization**
  - [ ] Interactive price charts and trend analysis (Chart.js/D3.js)
  - [ ] Market heat maps and geographic visualization
  - [ ] Portfolio performance dashboards
  - [ ] Risk assessment visualization tools

- [ ] **Mobile & Accessibility**
  - [ ] Mobile-responsive web interface
  - [ ] Mobile app development (React Native/Flutter)
  - [ ] Push notifications for trading opportunities
  - [ ] Accessibility compliance and optimization

- [ ] **User Experience Features**
  - [ ] Customizable dashboards and layouts
  - [ ] Export functionality (CSV, Excel, PDF reports)
  - [ ] User preferences and settings management
  - [ ] Multi-language support preparation

- [ ] **Real-time Features**
  - [ ] Live price updates and WebSocket integration
  - [ ] Real-time profit/loss tracking
  - [ ] Live market depth visualization
  - [ ] Instant arbitrage opportunity alerts

#### Phase 8: Advanced Features & Scaling 🚀 FUTURE

**Goal**: Enterprise-level features and external integrations

- [ ] **Machine Learning & AI**
  - [ ] Price prediction ML models
  - [ ] Market anomaly detection algorithms
  - [ ] Automated strategy optimization using AI
  - [ ] Natural language processing for market sentiment

- [ ] **External Integrations**
  - [ ] Third-party trading tool integrations
  - [ ] Discord/Slack bot for alerts and commands
  - [ ] Integration with EVE alliance/corporation tools
  - [ ] External market data source integration

- [ ] **Enterprise Features**
  - [ ] Multi-user support and role-based access
  - [ ] Team collaboration and shared operations
  - [ ] Audit logging and compliance features
  - [ ] Advanced security and encryption

- [ ] **Performance & Scaling**
  - [ ] Database optimization and sharding
  - [ ] Microservices architecture implementation
  - [ ] CDN integration for global performance
  - [ ] Load balancing and high availability setup

### 🔮 Future Enhancement Ideas (Phase 9+)

**Community & Social Features**

- Public arbitrage opportunity sharing (anonymous)
- Community-driven market insights and discussions
- Collaborative trading strategy development
- Public performance leaderboards (opt-in)

**Advanced Market Analysis**

- Cross-game economic analysis (EVE vs other MMOs)
- Real-world economic indicator correlation
- Cryptocurrency market pattern analysis
- Advanced statistical arbitrage techniques

**Educational Features**

- Trading tutorial and onboarding system
- Market analysis training modules
- Risk management educational content
- EVE economic theory and strategy guides

**API & Developer Tools**

- Public API for third-party developers
- Plugin/extension system for custom strategies
- SDK for external tool integration
- Open-source community contributions

### 📝 Technical Notes

**Current Architecture**

- Using PostgreSQL for better performance with large datasets
- NestJS for scalable backend architecture with proper service organization
- Prisma for type-safe database operations with proper relationships
- Daily data provides much richer analysis opportunities than weekly
- Proper normalization prevents data duplication and enables complex queries

**Phase 5+ Additions**

- ESI integration for real-time data (67 req/sec public, 333+ req/sec with auth)
- Smart rate limiting with ESI header monitoring and backoff strategies
- Advanced caching strategies for high-frequency price updates
- TypeScript interfaces for comprehensive type safety across all data models
- Real-time market price collection from tracked trade hubs

### 🐛 Issues & Considerations

**Current Challenges**

- Large dataset size (39k+ records per day, growing with real-time data)
- Need efficient querying strategies with proper indexing
- Storage optimization for historical data
- Data integrity across daily imports
- Player structures not in NPC station reference (locationId might not always map to Station)

**New Phase 5+ Challenges**

- ESI rate limiting (100 requests/second) vs data freshness requirements
- OAuth2 token management and refresh handling for multiple characters
- Real-time price data volume (potentially 10x current data size)
- Cross-region price synchronization and consistency
- Character API scope management and security considerations
- Market data accuracy during downtime or connectivity issues

## 🚀 **AVAILABLE API ENDPOINTS**

### **Reference Data Management**

```bash
GET    /reference-data/stats              # View reference data counts
POST   /reference-data/import             # Import from local doc/ folder
POST   /reference-data/fetch-fresh        # Download fresh data from Adam4EVE
POST   /reference-data/bootstrap          # Smart deployment (fresh → local fallback)
GET    /reference-data/check-availability # Check Adam4EVE file status
```

### **Tracked Station Management**

```bash
GET    /tracked-stations                  # List all tracked stations
GET    /tracked-stations/active           # List active tracked stations only
GET    /tracked-stations/stats            # Tracked station statistics
GET    /tracked-stations/:id              # Get specific tracked station
POST   /tracked-stations                  # Add new tracked station
PUT    /tracked-stations/:id              # Update tracked station
DELETE /tracked-stations/:id              # Remove tracked station
POST   /tracked-stations/initialize-defaults # Add 4 major trade hubs
```

### **Market Data Operations**

```bash
GET    /market-data/stats                 # Market data statistics & insights
GET    /market-data/latest                # Latest market data (limit=50)
GET    /market-data/query                 # Query with filters (stations, items, dates)
POST   /market-data/import                # Import from file path
POST   /market-data/import-sample         # Import sample data (for testing)
```

### **Daily Data Automation** 🤖

```bash
POST   /daily-data/fetch                  # Smart fetch missing daily files from Adam4EVE
GET    /daily-data/status                 # Check how up-to-date our data is
GET    /daily-data/available              # See what files are available on Adam4EVE
```

### **Internal Scheduler Management** ⏰

```bash
GET    /scheduler/status                  # Get scheduler status, next run time, last result
POST   /scheduler/trigger                 # Manually trigger daily fetch (testing/emergency)
PUT    /scheduler/enable                  # Enable automatic daily scheduling
PUT    /scheduler/disable                 # Disable automatic daily scheduling
```

### **ESI Integration** 🔄 (Phase 5A - MVP)

```bash
GET    /esi/status                        # Check ESI connectivity and basic health
GET    /esi/market-prices/:regionId       # Get current market prices for region (public data)
POST   /esi/fetch-item-volumes            # Update item volume data for tracked items
```

### **Basic Arbitrage** 💰 (Phase 5A - MVP)

```bash
GET    /arbitrage/opportunities           # Current arbitrage opportunities (simple list)
GET    /arbitrage/calculate               # Calculate profit for specific item/route
POST   /arbitrage/refresh-prices          # Manually refresh market prices
```

### **Enhanced Market Features** 📈 (Phase 5B - Later)

```bash
GET    /market-prices/current             # Current prices with advanced filtering
GET    /market-prices/history             # Price history and trend analysis
GET    /market-prices/alerts              # Price change alerts and notifications
POST   /market-prices/update-all          # Automated price updates
GET    /market-prices/trends              # Advanced trend analysis
```

### **Advanced Arbitrage** 🧮 (Phase 5B+ - Later)

```bash
GET    /arbitrage/optimize-shipment       # Optimize cargo for max profit/m³
GET    /arbitrage/risk-assessment         # Risk analysis for opportunities
GET    /arbitrage/portfolio-optimize      # Portfolio optimization recommendations
GET    /arbitrage/bulk-calculate          # Bulk route calculations
```

### **Character & Operation Tracking** 👨‍🚀 (Phase 5C - Later)

```bash
GET    /characters                        # List authenticated characters
POST   /characters/authenticate           # Add new character via ESI OAuth
GET    /characters/:id/assets             # Character assets and inventory
GET    /characters/:id/orders             # Character market orders
GET    /characters/:id/transactions       # Character transaction history
GET    /characters/:id/wallet             # Character wallet information
```

### **Trading Operations** 📊 (Phase 5C - Later)

```bash
GET    /operations                        # List all trading operations
POST   /operations                        # Create new trading operation
GET    /operations/:id                    # Get specific operation details
PUT    /operations/:id                    # Update operation status/details
GET    /operations/profit-analysis        # Profit analysis across all operations
GET    /operations/performance            # Character trading performance stats
```

### **Business Intelligence** 🤖 (Phase 6 - Future)

```bash
GET    /analytics/performance             # Advanced trading performance analytics
GET    /analytics/predictions             # Market predictions and forecasts
GET    /analytics/automation              # Automated trading strategy status
POST   /automation/strategies             # Create/update automated strategies
GET    /automation/rules                  # List trading automation rules
```

### **User Interface** 📊 (Phase 7 - Future)

```bash
GET    /dashboard/config                  # Dashboard configuration and layouts
POST   /dashboard/export                  # Export data to various formats
GET    /dashboard/realtime                # Real-time data for dashboard updates
WebSocket /ws/live-updates               # WebSocket for live price/profit updates
```

### 📋 All Major Features Completed ✅

**Phases 1-4 are fully functional and production-ready!**

## 🎯 **PROJECT STATUS & ROADMAP**

Your EVE Online Market Data Tracker has a **solid foundation** and is ready for advanced features:

✅ **Smart Reference Data Management** (Phase 1) - **COMPLETED**  
✅ **Selective Market Data Tracking** (Phase 2) - **COMPLETED**  
✅ **Comprehensive Data Access APIs** (Phase 3) - **COMPLETED**  
✅ **Automated Daily Data Pipeline** (Phase 4) - **COMPLETED**

🎯 **MVP Arbitrage System** (Phase 5A) - **IN PROGRESS**  
📈 **Enhanced Features** (Phase 5B) - **PLANNED**  
👨‍🚀 **Character Integration** (Phase 5C) - **PLANNED**  
🤖 **Business Intelligence** (Phase 6) - **FUTURE**  
📊 **User Interface** (Phase 7) - **FUTURE**  
🚀 **Advanced Features** (Phase 8) - **FUTURE**

### 🚀 **Current Statistics**

- **📊 Market Records**: 22,397 total records
- **📅 Date Range**: 2025-07-29 to 2025-07-30 (current!)
- **🏪 Tracked Stations**: 4 major trade hubs
- **⚡ Import Efficiency**: 70%+ storage savings (only tracked stations)
- **🔄 Update Status**: Up to date (1 day lag acceptable)
- **🤖 Automation**: Internal scheduler runs daily at 6 AM UTC
- **🎯 Deployment**: Zero external dependencies for scheduling

---

## 🎯 **UPCOMING MILESTONES**

### **Phase 5A: MVP Implementation Plan** (Next 1-2 weeks)

1. **Days 1-3**: ESI Basic Integration & Simple Database Schema
2. **Days 4-6**: Item Volume Data & Basic Arbitrage Engine
3. **Days 7-10**: Tax Calculations & API Endpoints
4. **Days 11-14**: Testing & Refinement

### **Success Metrics for Phase 5A (MVP)**

- ✅ ESI API can fetch current market prices for tracked hubs
- ✅ Basic arbitrage opportunities detected and ranked
- ✅ Profit calculations include taxes and ISK/m³ efficiency
- ✅ Simple API endpoints return useful arbitrage data
- ✅ System works manually (no automation needed yet)

### **Simplified Technical Approach**

- **ESI Integration**: Public market data only (no OAuth initially)
- **Rate Limiting**: Conservative 1 request/second to start
- **Data Storage**: Current prices only (no historical data yet)
- **Updates**: Manual refresh via API (no automated scheduling)
- **Calculations**: Basic taxes only (no skill bonuses initially)

---

**Last Updated**: January 2025  
**Status**: **FOUNDATION COMPLETE** ✅ → **BUILDING MVP ARBITRAGE** 🎯  
**Next Steps**: Start ESI basic integration for market price fetching
