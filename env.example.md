# Environment Configuration

## 🔧 **Required Variables**

```bash
# Database connection
DATABASE_URL="postgresql://username:password@localhost:5432/eve_trade_tracker"

# ESI API Configuration
# ESI_CLIENT_ID="your_esi_client_id_here"  # Optional - only needed for authenticated endpoints
ESI_USER_AGENT="EVE-Trade-Profit-Tracker/1.0.0 your-email@example.com +https://github.com/your/repo"
ESI_MAX_REQUESTS_PER_SECOND="50"  # 500 requests per 10 seconds = 50/sec
ESI_CONTACT_EMAIL="your-email@example.com"
```

## 📝 **Logging Configuration**

```bash
# Log level - controls what logs you see
# Options: error, warn, log, debug, verbose
LOG_LEVEL=log

# Examples for different scenarios:

# 🚨 Production (minimal logs)
LOG_LEVEL=warn

# 🔍 Development (balanced)
LOG_LEVEL=log

# 🐛 Debugging (detailed)
LOG_LEVEL=debug

# 🔬 Troubleshooting (everything)
LOG_LEVEL=verbose
```

## ⚙️ **Optional Configuration**

```bash
# Application port
PORT=3000

# Scheduler configuration
ENABLE_SCHEDULER=true

# ESI rate limiting
ESI_MAX_REQUESTS_PER_SECOND=100
ESI_USER_AGENT="EVE-Trade-Profit-Tracker/1.0.0"
```

## 📊 **Log Level Guide**

### **error** 🚨

Only critical errors that break functionality

```
[ERROR] Failed to connect to database
[ERROR] ESI API returned 500 error
```

### **warn** ⚠️

Important warnings + errors

```
[WARN] Low liquidity detected for item
[WARN] ESI rate limit approaching
[ERROR] Database connection failed
```

### **log** ℹ️ (Default)

General operational info + warnings + errors

```
[LOG] Application started on port 3000
[LOG] Imported 1,234 market records
[WARN] Low liquidity detected
[ERROR] Database connection failed
```

### **debug** 🔍

Detailed debugging + all above

```
[DEBUG] Processing item batch of 50 items
[DEBUG] ESI rate limit: 95/100 remaining
[LOG] Application started
[ERROR] Connection failed
```

### **verbose** 🔬

Everything including internal NestJS logs

```
[VERBOSE] HTTP request received: GET /api/arbitrage
[DEBUG] Calculating profit margins
[LOG] Found 15 opportunities
[ERROR] Failed to process
```

## 🎯 **Recommended Settings**

- **Development**: `LOG_LEVEL=log` (see important stuff without noise)
- **Production**: `LOG_LEVEL=warn` (only problems and warnings)
- **Debugging Issues**: `LOG_LEVEL=debug` (detailed troubleshooting)
- **New Feature Development**: `LOG_LEVEL=verbose` (see everything)

## 🔄 **How to Change Log Level**

1. **Edit your `.env` file** and change `LOG_LEVEL=debug`
2. **Restart the application**
3. **Logs will immediately reflect the new level**

No code changes needed - just environment configuration!
