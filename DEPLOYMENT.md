# Deployment & Cleanup Guide

## 🚀 Production Deployment Strategy

### **Recommended API Usage for Production**

```bash
# 1. PRODUCTION: Smart bootstrap (tries fresh first, falls back to local)
POST /reference-data/bootstrap

# 2. PRODUCTION: Regular updates (monthly after EVE patches)
POST /reference-data/fetch-fresh

# 3. MONITORING: Check current data status
GET /reference-data/stats

# 4. DIAGNOSTICS: Check if Adam4EVE is accessible
GET /reference-data/check-availability
```

### **Development/Emergency Only**

```bash
# LOCAL IMPORT: Only for development or emergency fallback
POST /reference-data/import
```

## 🗂️ **File & Folder Cleanup Recommendations**

### **KEEP (Important for Production)**

**1. `doc/` folder**

- **Purpose**: Backup/fallback reference data
- **Why**: Safety net if Adam4EVE is down during deployment
- **Size**: ~2.5MB total (acceptable overhead)
- **Usage**: Emergency fallback, development setup

**2. All service files**

- All reference data services are production-ready
- Bootstrap logic provides resilient deployment

### **CAN REMOVE (Optional)**

**1. Development artifacts**

```
# These could be removed in production build:
- *.spec.ts files (test files)
- development-only environment configs
- doc/ folder (if you want to rely only on live data)
```

**2. Temporary files (auto-cleaned)**

```
temp_adam4eve/  # Already auto-deleted by our service
node_modules/   # Not deployed anyway
```

## 📋 **Production Deployment Checklist**

### **1. Environment Setup**

```bash
# Set up your production environment variables
DATABASE_URL="postgresql://user:pass@host:port/db"
NODE_ENV="production"
PORT=3000
```

### **2. Initial Deployment**

```bash
# After app starts in production:
curl -X POST https://your-app.com/reference-data/bootstrap

# This will:
# ✅ Try fresh Adam4EVE data first
# ✅ Fall back to doc/ files if needed
# ✅ Skip if data already exists
```

### **3. Regular Updates**

```bash
# Monthly (after EVE patches):
curl -X POST https://your-app.com/reference-data/fetch-fresh

# This downloads latest reference data from Adam4EVE
```

### **4. Monitoring**

```bash
# Check current status:
curl https://your-app.com/reference-data/stats

# Expected response:
{
  "success": true,
  "data": {
    "regions": 113,
    "solarSystems": 8437,
    "stations": 5154,
    "itemTypes": 50000+
  }
}
```

## 🏗️ **Architecture Benefits for Production**

### **Resilient Bootstrap**

```
Production Deployment → POST /bootstrap
├── Try Adam4EVE (fresh data) ✅ PREFERRED
├── Fall back to doc/ folder ✅ BACKUP
└── Skip if data exists ✅ SMART
```

### **Graceful Updates**

```
EVE Patch Release → POST /fetch-fresh
├── Downloads latest reference data
├── Shows exactly what changed
├── Handles errors gracefully
└── Logs everything for monitoring
```

### **Zero-Dependency Fallback**

- `doc/` folder ensures your app can start even if:
  - Adam4EVE is down
  - Internet connectivity issues
  - DNS problems
  - Rate limiting

## 🎯 **Final Recommendation**

**KEEP the `doc/` folder** for these reasons:

1. **Small size** (~2.5MB vs 50GB+ potential market data)
2. **High value** (ensures 100% deployment success rate)
3. **Development friendly** (new developers can start immediately)
4. **Emergency recovery** (can restore reference data quickly)

**Your production flow:**

```bash
# Deploy app → POST /bootstrap → Done!
# Monthly updates → POST /fetch-fresh → Done!
```

The system is now **production-ready** with smart fallback strategies! 🚀
