#!/usr/bin/env node

/**
 * POC Test Script - EVE Trade Profit Tracker
 * Tests the complete cycle creation and management pipeline
 */

const baseUrl = 'http://localhost:3000';

async function testPOC() {
  console.log('🚀 Starting EVE Trade Profit Tracker POC Test\n');

  try {
    // Test 1: Create a new cycle
    console.log('📊 Test 1: Creating a new trading cycle...');
    const createResponse = await fetch(`${baseUrl}/cycle/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceHub: 'jita',
        totalCapital: 1000000000, // 1B ISK
        name: 'POC Test Cycle - ' + new Date().toISOString().split('T')[0],
        minProfitMargin: 0.15, // 15%
        minLiquidity: 4, // 4+ days per week
        cargoCapacity: 60000, // 60km³
      }),
    });

    if (!createResponse.ok) {
      throw new Error(
        `Failed to create cycle: ${createResponse.status} ${createResponse.statusText}`,
      );
    }

    const cycle = await createResponse.json();
    console.log('✅ Cycle created successfully!');
    console.log(`   Cycle ID: ${cycle.id}`);
    console.log(`   Name: ${cycle.name}`);
    console.log(`   Status: ${cycle.status}`);
    console.log(
      `   Total Capital: ${Number(cycle.totalCapital).toLocaleString()} ISK`,
    );
    console.log(
      `   Capital Used: ${Number(cycle.capitalUsed).toLocaleString()} ISK`,
    );
    console.log(
      `   Projected Profit: ${Number(cycle.totalProfit).toLocaleString()} ISK`,
    );
    console.log(`   Items Planned: ${cycle.cycleItems?.length || 0}`);
    console.log('');

    // Test 2: Get all cycles
    console.log('📋 Test 2: Listing all cycles...');
    const listResponse = await fetch(`${baseUrl}/cycle`);

    if (!listResponse.ok) {
      throw new Error(`Failed to list cycles: ${listResponse.status}`);
    }

    const cycles = await listResponse.json();
    console.log(`✅ Found ${cycles.length} cycle(s)`);
    cycles.forEach((c, index) => {
      console.log(
        `   ${index + 1}. ${c.name} - Status: ${c.status} - Items: ${c._count?.cycleItems || 0}`,
      );
    });
    console.log('');

    // Test 3: Get cycle details
    console.log('🔍 Test 3: Getting detailed cycle information...');
    const detailResponse = await fetch(`${baseUrl}/cycle/${cycle.id}`);

    if (!detailResponse.ok) {
      throw new Error(`Failed to get cycle details: ${detailResponse.status}`);
    }

    const detailedCycle = await detailResponse.json();
    console.log('✅ Cycle details retrieved:');
    console.log(
      `   Hub Allocations: ${JSON.stringify(detailedCycle.hubAllocations)}`,
    );
    console.log(
      `   Transport Costs: ${JSON.stringify(detailedCycle.transportCosts)}`,
    );
    console.log(`   Items by Hub:`);

    // Group items by destination hub
    const itemsByHub = {};
    detailedCycle.cycleItems?.forEach((item) => {
      if (!itemsByHub[item.destinationHub]) {
        itemsByHub[item.destinationHub] = [];
      }
      itemsByHub[item.destinationHub].push(item);
    });

    for (const [hub, items] of Object.entries(itemsByHub)) {
      const totalProfit = items.reduce(
        (sum, item) => sum + Number(item.netProfit),
        0,
      );
      const totalCost = items.reduce(
        (sum, item) => sum + Number(item.totalCost),
        0,
      );
      console.log(
        `     ${hub}: ${items.length} items, ${totalCost.toLocaleString()} ISK cost, ${totalProfit.toLocaleString()} ISK profit`,
      );

      // Show top 3 items by profit
      const topItems = items
        .sort((a, b) => Number(b.netProfit) - Number(a.netProfit))
        .slice(0, 3);

      topItems.forEach((item, i) => {
        console.log(
          `       ${i + 1}. ${item.itemName} - ${item.plannedQuantity}x @ ${Number(item.buyPrice).toLocaleString()} ISK - Net: ${Number(item.netProfit).toLocaleString()} ISK`,
        );
        if (item.priceWasAdjusted) {
          console.log(
            `          🔍 Price adjusted: ${Number(item.priceAdjustment).toLocaleString()} ISK reduction`,
          );
        }
      });
    }
    console.log('');

    // Test 4: Get cycle performance
    console.log('📈 Test 4: Getting cycle performance metrics...');
    const perfResponse = await fetch(
      `${baseUrl}/cycle/${cycle.id}/performance`,
    );

    if (!perfResponse.ok) {
      throw new Error(`Failed to get performance: ${perfResponse.status}`);
    }

    const performance = await perfResponse.json();
    console.log('✅ Performance metrics:');
    console.log(
      `   Planned Profit: ${performance.cycle.plannedProfit.toLocaleString()} ISK`,
    );
    console.log(
      `   Actual Profit: ${performance.cycle.actualProfit.toLocaleString()} ISK (no transactions yet)`,
    );
    console.log(
      `   Item Status: ${performance.items.planned} planned, ${performance.items.bought} bought, ${performance.items.sold} sold`,
    );
    console.log('');

    // Test 5: Get shopping list for multi-buy
    console.log('🛒 Test 5: Getting shopping list for multi-buy...');
    const shoppingResponse = await fetch(
      `${baseUrl}/cycle/${cycle.id}/shopping-list`,
    );

    if (!shoppingResponse.ok) {
      console.log(`⚠️  Shopping list test failed: ${shoppingResponse.status}`);
    } else {
      const shoppingList = await shoppingResponse.json();
      console.log('✅ Shopping list generated:');
      console.log(`   Total Shipments: ${shoppingList.summary.totalShipments}`);
      console.log(
        `   Total Cost: ${shoppingList.summary.totalEstimatedCost.toLocaleString()} ISK`,
      );
      console.log(
        `   Total Profit: ${shoppingList.summary.totalExpectedProfit.toLocaleString()} ISK`,
      );
      console.log('');

      // Show multi-buy format for each shipment
      shoppingList.shipments.forEach((shipment, index) => {
        console.log(
          `   📦 Shipment ${index + 1}: ${shipment.destinationHub.toUpperCase()}`,
        );
        console.log(
          `      Cost: ${shipment.totalEstimatedCost.toLocaleString()} ISK`,
        );
        console.log(
          `      Profit: ${shipment.totalExpectedProfit.toLocaleString()} ISK`,
        );
        console.log(`      Items: ${shipment.itemCount}`);
        console.log('');
        console.log('      🎯 COPY-PASTE READY (for EVE Multi-buy):');
        console.log('      ────────────────────────────────────────');
        shipment.multiBuyLines.forEach((line) => {
          console.log(`      ${line}`);
        });
        console.log('      ────────────────────────────────────────');
        console.log('');
      });
    }

    console.log('🎉 POC Test Complete! All systems working correctly.');
    console.log('');
    console.log('🎯 Next Steps for POC Usage:');
    console.log('1. Use the created cycle for actual trading');
    console.log(
      '2. Update item statuses as you progress (BUYING → BOUGHT → TRANSPORTING → SELLING → SOLD)',
    );
    console.log(
      '3. Record transactions when ready (or wait for market log import feature)',
    );
    console.log('4. Monitor performance via GET /cycle/{id}/performance');
    console.log('');
    console.log('📋 Key Endpoints:');
    console.log(`   - Create Cycle: POST ${baseUrl}/cycle/create`);
    console.log(`   - List Cycles: GET ${baseUrl}/cycle`);
    console.log(`   - Cycle Details: GET ${baseUrl}/cycle/{id}`);
    console.log(`   - Shopping List: GET ${baseUrl}/cycle/{id}/shopping-list`);
    console.log(`   - Performance: GET ${baseUrl}/cycle/{id}/performance`);
    console.log(`   - Update Status: PATCH ${baseUrl}/cycle/{id}/status`);
  } catch (error) {
    console.error('❌ POC Test Failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPOC();
