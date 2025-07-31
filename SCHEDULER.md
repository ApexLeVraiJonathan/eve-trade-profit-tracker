# 🤖 Internal Scheduler Documentation

## Overview

The EVE Market Data Tracker includes a built-in **NestJS cron scheduler** that automatically fetches daily market data from Adam4EVE without requiring external cron jobs or task schedulers.

## ⏰ **Schedule Details**

- **Run Time**: Every day at **6:00 AM UTC**
- **Frequency**: Daily
- **Purpose**: Download and import missing daily market data files
- **Cron Expression**: `0 0 6 * * *`

### Why 6:00 AM UTC?

Adam4EVE processes their daily market data files at approximately **5:30 AM UTC**. Our scheduler runs 30 minutes later to ensure the files are ready for download.

## 🔧 **Configuration**

### Environment Variables

Add to your `.env` file:

```env
# Enable/disable automatic scheduling
ENABLE_SCHEDULER=true

# Database connection (required)
DATABASE_URL="postgresql://username:password@localhost:5432/eve_trades?schema=public"
```

### Environment Variable Options

| Variable           | Default | Description                                    |
| ------------------ | ------- | ---------------------------------------------- |
| `ENABLE_SCHEDULER` | `true`  | Set to `false` to disable automatic scheduling |

## 🚀 **Production Deployment**

### 1. **Enable Scheduling**

```env
ENABLE_SCHEDULER=true
```

### 2. **Start Application**

```bash
# Using PM2 (recommended)
pm2 start dist/main.js --name "eve-tracker"

# Or using Docker
docker run -d --name eve-tracker \
  -e ENABLE_SCHEDULER=true \
  -e DATABASE_URL="..." \
  your-image:latest

# Or direct Node.js
node dist/main.js
```

### 3. **Monitor Scheduling**

```bash
# Check scheduler status
curl http://localhost:3000/scheduler/status

# Expected response:
{
  "success": true,
  "data": {
    "isProcessing": false,
    "isEnabled": true,
    "lastRunTime": "2025-07-31T06:00:01.234Z",
    "lastRunResult": "✅ SUCCESS: Successfully imported 1 daily files with 11249 total records",
    "nextRunTime": "2025-08-01T06:00:00.000Z",
    "cronExpression": "0 0 6 * * *",
    "timezone": "UTC"
  }
}
```

## 📋 **API Endpoints**

### Get Scheduler Status

```bash
GET /scheduler/status
```

Returns current scheduler state, last run results, and next scheduled run time.

### Manual Trigger (Testing/Emergency)

```bash
POST /scheduler/trigger
```

Immediately starts a daily data fetch. Useful for:

- Testing the system
- Emergency data updates
- Recovery after downtime

### Enable/Disable Scheduling

```bash
# Enable automatic scheduling
PUT /scheduler/enable

# Disable automatic scheduling
PUT /scheduler/disable
```

## 🔍 **Monitoring & Logging**

### Application Logs

The scheduler provides detailed logging:

```log
[DailyDataSchedulerService] Daily Data Scheduler initialized
[DailyDataSchedulerService] 🤖 Starting scheduled daily market data fetch...
[DailyDataFetcherService] Starting daily data fetch process
[DailyDataFetcherService] Found 1 files to fetch: marketOrderTrades_daily_2025-07-31.csv
[DailyDataFetcherService] Successfully downloaded marketOrderTrades_daily_2025-07-31.csv
[MarketDataService] Successfully imported 11249 records from marketOrderTrades_daily_2025-07-31.csv
[DailyDataSchedulerService] ✅ Scheduled fetch completed successfully: Successfully imported 1 daily files with 11249 total records
[DailyDataSchedulerService] 📊 Import Statistics:
- Files to fetch: 1
- Files downloaded: 1
- Files imported: 1
- Files failed: 0
- Total records imported: 11249
- Duration: 2847ms
```

### Error Handling

Failed runs are logged with full error details:

```log
[DailyDataSchedulerService] ❌ Scheduled fetch failed: Download error for marketOrderTrades_daily_2025-07-31.csv: ENOTFOUND
```

## 🛠️ **Development Setup**

### Disable Scheduling in Development

```env
ENABLE_SCHEDULER=false
```

This prevents automatic daily fetching during development. You can still:

- Use manual triggers: `POST /scheduler/trigger`
- Use manual fetch: `POST /daily-data/fetch`
- Test with sample data: `POST /market-data/import-sample`

### Enable for Testing

```env
ENABLE_SCHEDULER=true
```

Then trigger manually for immediate testing:

```bash
curl -X POST http://localhost:3000/scheduler/trigger
```

## 🔄 **How It Works**

1. **Daily at 6 AM UTC**: Scheduler automatically wakes up
2. **Check Database**: Finds the latest market data date
3. **Calculate Missing**: Determines which daily files are missing
4. **Smart Download**: Only downloads files we don't have (max 16 days back)
5. **Filtered Import**: Only imports data for tracked stations (70%+ efficiency)
6. **Cleanup**: Removes temporary files
7. **Logging**: Records detailed results for monitoring

## 🎯 **Key Benefits**

### ✅ **Fully Self-Contained**

- No external cron jobs or task schedulers needed
- No additional infrastructure dependencies
- No HTTP calls to external endpoints

### ✅ **Production Ready**

- Handles network failures gracefully
- Prevents duplicate processing
- Detailed logging for monitoring
- Configurable via environment variables

### ✅ **Development Friendly**

- Easy to disable during development
- Manual triggers for testing
- Clear status and monitoring endpoints

### ✅ **Efficient & Smart**

- Only downloads missing files
- Only imports data for tracked stations
- Automatic gap detection and recovery

## 🚨 **Troubleshooting**

### Scheduler Not Running

1. Check `ENABLE_SCHEDULER=true` in environment
2. Check application logs for startup messages
3. Verify `/scheduler/status` shows `"isEnabled": true`

### Import Failures

1. Check `/scheduler/status` for `lastRunResult`
2. Review application logs for error details
3. Manually trigger: `POST /scheduler/trigger`
4. Check Adam4EVE availability: `GET /daily-data/available`

### Duplicate Processing

The scheduler prevents duplicate runs with built-in locks. If one fetch is running, subsequent triggers are skipped with appropriate logging.

## 📈 **Performance**

- **Memory**: Processes files in 1000-record batches
- **Storage**: Only stores data for tracked stations (~70% savings)
- **Duration**: Typical import takes 2-5 seconds per file
- **Reliability**: Automatic retry and recovery mechanisms

---

**Your EVE market tracker now runs completely autonomously! 🚀**
