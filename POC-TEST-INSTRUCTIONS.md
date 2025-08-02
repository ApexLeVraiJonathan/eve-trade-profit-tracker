# 🚀 EVE Trade Profit Tracker - POC Test Instructions

## Prerequisites

1. **Stop the development server** (Ctrl+C in the terminal where `pnpm run start:dev` is running)
2. **Regenerate Prisma client** to include new database models
3. **Restart the server**
4. **Run the test script**

## Step-by-Step Instructions

### 1. Stop the Server

In your terminal where the dev server is running, press `Ctrl+C` to stop it.

### 2. Regenerate Prisma Client

```bash
pnpm dlx prisma generate
```

### 3. Restart the Development Server

```bash
pnpm run start:dev
```

### 4. Run the POC Test

In a new terminal window:

```bash
node test-poc-cycle.js
```

## What the Test Does

The test script will:

1. **Create a New Cycle**
   - 1B ISK capital allocation
   - Uses Greedy algorithm for item selection
   - Applies price validation and liquidity filtering
   - Distributes across all 4 hubs (Amarr, Dodixie, Hek, Rens)

2. **List All Cycles**
   - Shows all cycles in the system
   - Displays basic stats for each

3. **Get Detailed Cycle Info**
   - Shows planned items by hub
   - Displays top 3 most profitable items per hub
   - Shows price adjustments (if any)

4. **Check Performance Metrics**
   - Planned vs actual profit (will be 0 initially)
   - Item status breakdown

5. **Test Algorithm Competition**
   - Compares Greedy vs Dynamic Programming vs Hybrid
   - Shows which algorithm performed best

## Expected Results

✅ **Successful POC** should show:

- Cycle created with dozens of profitable items
- Items distributed across multiple hubs
- Price validation working (some items showing adjustments)
- Net profit calculations including transport costs
- Performance tracking ready

## Manual Testing Endpoints

After the automated test, you can manually test:

### Create a Custom Cycle

```bash
curl -X POST http://localhost:3000/cycle/create \
  -H "Content-Type: application/json" \
  -d '{
    "sourceHub": "jita",
    "totalCapital": 500000000,
    "name": "My Custom Cycle",
    "allocations": {
      "amarr": 0.6,
      "dodixie": 0.4
    }
  }'
```

### Get Algorithm Competition

```bash
curl "http://localhost:3000/cycle/algorithm-competition?sourceHub=jita&destinationHub=amarr&budget=500000000"
```

### Update Cycle Status

```bash
curl -X PATCH http://localhost:3000/cycle/{CYCLE_ID}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "ACTIVE"}'
```

## Troubleshooting

If tests fail:

1. **Server not running**: Make sure `pnpm run start:dev` is running
2. **Database connection**: Check your PostgreSQL connection
3. **Missing data**: Ensure market data has been imported
4. **Prisma client**: Run `pnpm dlx prisma generate` if you see model errors

## Ready for Production POC!

Once tests pass, you can start using this for actual EVE Online trading:

1. Create cycles for your available capital
2. Use the item lists for shopping in Jita
3. Transport goods to destination hubs
4. Sell and track performance
5. Compare actual vs projected profits

**The system is ready for real trading! 🎯**
