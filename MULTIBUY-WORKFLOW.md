# 🛒 EVE Online Multi-Buy Workflow - CORRECTED

## The Problem You Found ✅

You're absolutely right! The JSON response escapes the line breaks as `\n` and tabs as `\t`, so when you copy:

```
Breacher Pod Rapid Firing\t3\nSmall Vorton Specialization\t16
```

EVE only sees the first item because it doesn't recognize the escaped characters.

## ✅ SOLUTION: Raw Text Endpoint

I've added a **raw text endpoint** that returns properly formatted text:

### Step 1: Get Your Cycle ID

```bash
POST /cycle/create
# Returns: { "id": "clxxxxxx", ... }
```

### Step 2: Get the Shopping List Overview

```bash
GET /cycle/{cycleId}/shopping-list
# Shows all shipments and their hubs
```

### Step 3: Get Raw Multi-Buy Text for Each Hub

```bash
GET /cycle/{cycleId}/shopping-list/amarr/raw
GET /cycle/{cycleId}/shopping-list/dodixie/raw
GET /cycle/{cycleId}/shopping-list/hek/raw
GET /cycle/{cycleId}/shopping-list/rens/raw
```

### Step 4: Copy the `copyPasteFormat` Field

**Example Raw Response:**

```json
{
  "hub": "amarr",
  "totalCost": 456000000,
  "totalProfit": 89000000,
  "itemCount": 23,
  "copyPasteFormat": "Breacher Pod Rapid Firing\t3\nSmall Vorton Specialization\t16\nSensor Booster II\t1\nOmnidirectional Tracking Enhancer II\t3",
  "instructions": [
    "Copy the text from 'copyPasteFormat' field",
    "Paste directly into EVE Online Multi-buy tab",
    "Expected total cost: 456,000,000 ISK"
  ]
}
```

**⚠️ Important**: Copy the exact text from the `copyPasteFormat` field - it contains real line breaks and tabs that EVE can understand!

## 🎯 In-Game Workflow

1. **Get the raw endpoint** for your target hub
2. **Copy the `copyPasteFormat` text** (with proper line breaks)
3. **Go to Jita** → Market → Multi-buy tab
4. **Paste the text** - should show multiple items now!
5. **Verify total cost** matches the `totalCost` field (±10%)
6. **Check for outliers** - any item much more expensive than expected
7. **Buy and transport** to the destination hub

## 🧪 Test This First

When you run `node test-poc-cycle.js`, it will now show:

```
Raw endpoint: GET /cycle/{cycleId}/shopping-list/amarr/raw
```

**Test the raw endpoint manually**:

```bash
curl "http://localhost:3000/cycle/{your-cycle-id}/shopping-list/amarr/raw"
```

The `copyPasteFormat` field should have actual line breaks that work in EVE!

## 📋 Quick Reference

| Endpoint                                    | Purpose                           |
| ------------------------------------------- | --------------------------------- |
| `GET /cycle/{id}/shopping-list`             | Overview of all shipments         |
| `GET /cycle/{id}/shopping-list/amarr/raw`   | Copy-paste ready text for Amarr   |
| `GET /cycle/{id}/shopping-list/dodixie/raw` | Copy-paste ready text for Dodixie |
| `GET /cycle/{id}/shopping-list/hek/raw`     | Copy-paste ready text for Hek     |
| `GET /cycle/{id}/shopping-list/rens/raw`    | Copy-paste ready text for Rens    |

This should fix the multi-buy issue completely! 🎯
