import { fetchTruncgil } from "./sources/truncgil.js";
import { fetchOnsAltin } from "./sources/yahoo.js";
import { buildResponse } from "./normalize.js";

const t0 = Date.now();
const [truncgil, ons] = await Promise.allSettled([
  fetchTruncgil(),
  fetchOnsAltin(),
]);
const dt = Date.now() - t0;

console.log(`fetched in ${dt}ms`);
console.log("  truncgil:", truncgil.status);
console.log("  yahoo ons:", ons.status);

if (truncgil.status !== "fulfilled") {
  console.error("truncgil failed:", truncgil.reason);
  process.exit(1);
}

const onsValue =
  ons.status === "fulfilled"
    ? { price: ons.value.price, changePct: ons.value.changePct }
    : null;

const response = buildResponse(truncgil.value, onsValue, "smoke");

console.log("\n===== UNIFIED RESPONSE =====");
console.log(`updatedAt: ${response.updatedAt}`);
console.log(`source: ${response.source}`);
console.log(`items: ${response.items.length}\n`);

const groups = ["uluslararasi", "gram", "ziynet"] as const;
for (const g of groups) {
  console.log(`--- ${g.toUpperCase()} ---`);
  for (const item of response.items.filter((i) => i.group === g)) {
    const buy = item.buy?.toLocaleString("tr-TR") ?? "—";
    const sell = item.sell?.toLocaleString("tr-TR") ?? "—";
    const ch = (item.change >= 0 ? "+" : "") + item.change.toFixed(2) + "%";
    const star = item.featured ? " ★" : "";
    console.log(`  ${item.code.padEnd(12)} ${item.name.padEnd(22)} buy=${buy.padStart(12)} sell=${sell.padStart(12)} ${ch.padStart(7)}${star}`);
  }
  console.log();
}
