import type { PriceItem, PricesResponse, TruncgilResponse } from "./types.js";

const PURITY_22A = 0.916;
const PURITY_21A = 0.875;

function pickRate(
  data: TruncgilResponse,
  key: string,
): { buy: number | null; sell: number | null; change: number } | null {
  const r = data.Rates[key];
  if (!r) return null;
  const buy = typeof r.Buying === "number" && r.Buying > 0 ? r.Buying : null;
  const sell = typeof r.Selling === "number" && r.Selling > 0 ? r.Selling : null;
  const change = typeof r.Change === "number" ? r.Change : 0;
  if (buy === null && sell === null) return null;
  return { buy, sell, change };
}

export function buildItems(
  truncgil: TruncgilResponse,
  ons: { price: number; changePct: number } | null,
): PriceItem[] {
  const items: PriceItem[] = [];

  // ===== ULUSLARARASI =====
  if (ons) {
    items.push({
      code: "ONS",
      name: "Ons Altın",
      subText: "USD / ons",
      group: "uluslararasi",
      buy: null,
      sell: round(ons.price, 2),
      change: round(ons.changePct, 2),
      unit: "USD",
    });
  }

  const usd = pickRate(truncgil, "USD");
  if (usd) {
    items.push({
      code: "USDTRY",
      name: "Dolar",
      subText: "USD / TRY",
      group: "uluslararasi",
      buy: round(usd.buy, 4),
      sell: round(usd.sell, 4),
      change: round(usd.change, 2),
    });
  }

  const eur = pickRate(truncgil, "EUR");
  if (eur) {
    items.push({
      code: "EURTRY",
      name: "Euro",
      subText: "EUR / TRY",
      group: "uluslararasi",
      buy: round(eur.buy, 4),
      sell: round(eur.sell, 4),
      change: round(eur.change, 2),
    });
  }

  const gbp = pickRate(truncgil, "GBP");
  if (gbp) {
    items.push({
      code: "GBPTRY",
      name: "Sterlin",
      subText: "GBP / TRY",
      group: "uluslararasi",
      buy: round(gbp.buy, 4),
      sell: round(gbp.sell, 4),
      change: round(gbp.change, 2),
    });
  }

  // ===== GRAM =====
  const has = pickRate(truncgil, "HAS");
  if (has) {
    items.push({
      code: "HAS",
      name: "Has Altın",
      subText: "24 AYAR · 995/1000",
      group: "gram",
      buy: round(has.buy, 2),
      sell: round(has.sell, 2),
      change: round(has.change, 2),
      featured: true,
    });

    if (has.buy !== null && has.sell !== null) {
      items.push({
        code: "AYR22",
        name: "22 Ayar Bilezik",
        subText: "916/1000 · hesaplanan",
        group: "gram",
        buy: round(has.buy * PURITY_22A, 2),
        sell: round(has.sell * PURITY_22A, 2),
        change: round(has.change, 2),
      });

      items.push({
        code: "AYR21",
        name: "21 Ayar",
        subText: "875/1000 · hesaplanan",
        group: "gram",
        buy: round(has.buy * PURITY_21A, 2),
        sell: round(has.sell * PURITY_21A, 2),
        change: round(has.change, 2),
      });
    }
  }

  const ayr18 = pickRate(truncgil, "18AYARALTIN");
  if (ayr18) {
    items.push({
      code: "AYR18",
      name: "18 Ayar",
      subText: "750/1000",
      group: "gram",
      buy: round(ayr18.buy, 2),
      sell: round(ayr18.sell, 2),
      change: round(ayr18.change, 2),
    });
  }

  const ayr14 = pickRate(truncgil, "14AYARALTIN");
  if (ayr14) {
    items.push({
      code: "AYR14",
      name: "14 Ayar",
      subText: "585/1000",
      group: "gram",
      buy: round(ayr14.buy, 2),
      sell: round(ayr14.sell, 2),
      change: round(ayr14.change, 2),
    });
  }

  const gumus = pickRate(truncgil, "GUMUS");
  if (gumus) {
    items.push({
      code: "GUMUS",
      name: "Gümüş",
      subText: "XAG · GRAM",
      group: "gram",
      buy: round(gumus.buy, 2),
      sell: round(gumus.sell, 2),
      change: round(gumus.change, 2),
    });
  }

  // ===== ZİYNET =====
  const ziynetMap: Array<[string, string, string, string]> = [
    ["CEYREKALTIN", "CEY", "Çeyrek Altın", "1,75 GR · 22 AYAR"],
    ["YARIMALTIN", "YARIM", "Yarım Altın", "3,50 GR · 22 AYAR"],
    ["TAMALTIN", "TAM", "Tam Altın", "7,00 GR · 22 AYAR"],
    ["CUMHURIYETALTINI", "CUMHURIYET", "Cumhuriyet Altını", "7,22 GR · 22 AYAR"],
    ["RESATALTIN", "RESAT", "Reşat Altını", "7,22 GR · 22 AYAR"],
    ["ATAALTIN", "ATA", "Ata Altın", "7,22 GR · 22 AYAR"],
  ];
  for (const [key, code, name, sub] of ziynetMap) {
    const r = pickRate(truncgil, key);
    if (!r) continue;
    items.push({
      code,
      name,
      subText: sub,
      group: "ziynet",
      buy: round(r.buy, 2),
      sell: round(r.sell, 2),
      change: round(r.change, 2),
    });
  }

  return items;
}

export function buildResponse(
  truncgil: TruncgilResponse,
  ons: { price: number; changePct: number } | null,
  source: string,
): PricesResponse {
  return {
    updatedAt: new Date().toISOString(),
    online: true,
    source,
    items: buildItems(truncgil, ons),
  };
}

function round(n: number | null, decimals: number): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
