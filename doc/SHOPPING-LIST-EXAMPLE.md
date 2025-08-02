# 🛒 EVE Online Multi-Buy Shopping List Example

## How to Use the Shopping List

### 1. Get Your Shopping List

```bash
GET /cycle/{cycleId}/shopping-list
```

### 2. Example Response Structure

```json
{
  "cycle": {
    "id": "clxxxxx",
    "name": "POC Test Cycle",
    "sourceHub": "jita",
    "status": "PLANNED"
  },
  "summary": {
    "totalShipments": 4,
    "totalItems": 47,
    "totalEstimatedCost": 987000000,
    "totalExpectedProfit": 156000000
  },
  "shipments": [
    {
      "destinationHub": "amarr",
      "totalEstimatedCost": 456000000,
      "totalExpectedProfit": 89000000,
      "itemCount": 23,
      "multiBuyFormat": "Breacher Pod Rapid Firing\t3\nSmall Vorton Specialization\t16\nSensor Booster II\t1\nOmnidirectional Tracking Enhancer II\t3",
      "itemDetails": [
        {
          "name": "Breacher Pod Rapid Firing",
          "quantity": 3,
          "estimatedCostPerUnit": 109300000,
          "totalEstimatedCost": 327900000,
          "expectedProfit": 7191500,
          "daysTraded": 4,
          "priceWasAdjusted": false
        }
      ],
      "instructions": [
        "1. Go to JITA (Jita IV - Moon 4 - Caldari Navy Assembly Plant)",
        "2. Open Market window",
        "3. Click \"Multi-buy\" tab",
        "4. Paste the list below into multi-buy",
        "5. Verify total cost is around 456,000,000 ISK",
        "6. Check individual prices for outliers before buying",
        "7. Transport to AMARR",
        "8. Expected profit: 89,000,000 ISK"
      ]
    }
  ]
}
```

### 3. In-Game Multi-Buy Process

#### Step 1: Copy the Multi-Buy Format

From the API response, copy the `multiBuyFormat` text:

```
Breacher Pod Rapid Firing	3
Small Vorton Specialization	16
Sensor Booster II	1
Omnidirectional Tracking Enhancer II	3
Drone Link Augmentor II	4
Curator I	10
Hammerhead II	5
Bouncer I	10
```

#### Step 2: In EVE Online

1. **Go to Jita** (Jita IV - Moon 4 - Caldari Navy Assembly Plant)
2. **Open Market Window** (Alt+R)
3. **Click "Multi-buy" tab** (top of market window)
4. **Paste the list** into the multi-buy field
5. **Check the total cost** - should match `totalEstimatedCost` (±10%)
6. **Review individual prices** for outliers:
   - If an item is significantly more expensive than `estimatedCostPerUnit`, skip it
   - Look for items where `priceWasAdjusted: true` - these had inflated prices corrected
7. **Buy the items**
8. **Transport to destination hub**

#### Step 3: Price Validation

Before clicking "Buy All":

- **Total should be**: ~456,000,000 ISK (in this example)
- **If total is much higher**: Look for individual items that are overpriced
- **Safe rule**: If any single item costs >50% more than `estimatedCostPerUnit`, skip it

#### Step 4: Profit Tracking

- **Expected profit**: 89,000,000 ISK (in this example)
- **Transport cost**: Already included in calculations
- **Margin**: ~19.5% in this example

## Separate Shipments by Hub

The API automatically creates separate shopping lists for each destination hub:

### 🎯 Amarr Shipment (50% allocation)

- Highest volume, best margins
- 23 items, 456M ISK cost, 89M profit

### 🚀 Dodixie Shipment (30% allocation)

- Good secondary market
- 15 items, 287M ISK cost, 45M profit

### ⚡ Hek Shipment (10% allocation)

- Smaller market, focused opportunities
- 5 items, 98M ISK cost, 14M profit

### 🔥 Rens Shipment (10% allocation)

- Niche opportunities
- 4 items, 96M ISK cost, 8M profit

## Pro Tips for POC Usage

1. **Start with one shipment** - test the system with Amarr first
2. **Double-check high-value items** - anything >100M ISK per unit
3. **Watch for price adjustments** - items with `priceWasAdjusted: true` were corrected from inflated prices
4. **Use cargo optimization** - all shipments are designed for 60km³ capacity
5. **Track liquidity** - items are pre-filtered for 4+ days/week trading activity

This format makes it super easy to execute the trading plan in-game! 🎯
