/**
 * Quick test script to fetch today's conversion report from Shopee Affiliate API
 *
 * Usage: npx tsx packages/shopee-api/src/test-conversion.ts
 */
import { ShopeeAffiliateClient } from "./client";

const APP_ID = process.env.SHOPEE_APP_ID;
const SECRET = process.env.SHOPEE_SECRET;

if (!APP_ID || !SECRET) {
  console.error(
    "❌ Missing env vars: SHOPEE_APP_ID and SHOPEE_SECRET are required",
  );
  console.error(
    "   Run: SHOPEE_APP_ID=xxx SHOPEE_SECRET=yyy npx tsx packages/shopee-api/src/test-conversion.ts",
  );
  process.exit(1);
}

async function main() {
  const client = new ShopeeAffiliateClient({
    appId: APP_ID!,
    secret: SECRET!,
  });

  // Query last 24 hours conversions
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;

  console.log("=== Shopee Affiliate Conversion Report ===");
  console.log(
    `Time range: ${new Date(oneDayAgo * 1000).toISOString()} → ${new Date(now * 1000).toISOString()}`,
  );
  console.log("");

  try {
    // First, try a simple query to test auth works
    console.log("Testing API connection...");
    const result = await client.getConversionReport({
      purchaseTimeStart: oneDayAgo,
      purchaseTimeEnd: now,
      limit: 100,
    });

    console.log(`✅ API connected successfully!`);
    console.log(`Found ${result.nodes.length} conversion(s)`);
    console.log(`Has next page: ${result.pageInfo.hasNextPage}`);
    console.log("");

    if (result.nodes.length === 0) {
      console.log("No conversions found in the last 24 hours.");
      console.log("");
      console.log("Trying last 7 days...");

      const sevenDaysAgo = now - 7 * 86400;
      const result7d = await client.getConversionReport({
        purchaseTimeStart: sevenDaysAgo,
        purchaseTimeEnd: now,
        limit: 100,
      });

      console.log(
        `Found ${result7d.nodes.length} conversion(s) in last 7 days`,
      );

      if (result7d.nodes.length > 0) {
        printConversions(result7d.nodes);
      }
    } else {
      printConversions(result.nodes);
    }
  } catch (err: unknown) {
    console.error("❌ API Error:", err);

    if (err instanceof Error) {
      console.error("Message:", err.message);
    }
  }
}

function printConversions(nodes: any[]) {
  let totalCommission = 0;
  let totalOrders = 0;
  let totalItems = 0;

  for (const conv of nodes) {
    const purchaseDate = new Date(conv.purchaseTime * 1000).toLocaleString(
      "th-TH",
    );
    const commission = parseFloat(conv.totalCommission || "0");
    totalCommission += commission;

    console.log(`\n--- Conversion #${conv.conversionId} ---`);
    console.log(`  Purchase Time: ${purchaseDate}`);
    console.log(`  Buyer Type: ${conv.buyerType}`);
    console.log(`  Device: ${conv.device}`);
    console.log(`  Total Commission: ฿${commission.toFixed(2)}`);
    console.log(
      `  Shopee Commission: ฿${parseFloat(conv.shopeeCommissionCapped || "0").toFixed(2)}`,
    );
    console.log(
      `  Seller Commission: ฿${parseFloat(conv.sellerCommission || "0").toFixed(2)}`,
    );
    console.log(
      `  Net Commission: ฿${parseFloat(conv.netCommission || "0").toFixed(2)}`,
    );

    if (conv.orders) {
      for (const order of conv.orders) {
        totalOrders++;
        console.log(`  Order ${order.orderId} [${order.orderStatus}]`);
        if (order.items) {
          for (const item of order.items) {
            totalItems++;
            console.log(`    - ${item.itemName}`);
            console.log(`      Price: ฿${item.itemPrice} × ${item.qty}`);
            console.log(`      Commission: ฿${item.itemTotalCommission}`);
            console.log(`      Status: ${item.displayItemStatus}`);
          }
        }
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total Conversions: ${nodes.length}`);
  console.log(`Total Orders: ${totalOrders}`);
  console.log(`Total Items: ${totalItems}`);
  console.log(`Total Commission: ฿${totalCommission.toFixed(2)}`);
}

main();
