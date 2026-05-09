import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";

export const config = {
  runtime: "nodejs",
};

// =====================  Types  =====================

type PriceGroup = "uluslararasi" | "gram" | "ziynet";

type PriceItem = {
  code: string;
  name: string;
  subText?: string;
  group: PriceGroup;
  buy: number | null;
  sell: number | null;
  change: number;
  unit?: string;
  featured?: boolean;
};

type PricesResponse = {
  updatedAt: string;
  online: boolean;
  source: string;
  items: PriceItem[];
};

type TruncgilRate = {
  Buying: number | null;
  Selling: number | null;
  Type: string;
  Change: number;
};

type TruncgilResponse = {
  Meta_Data: { Minutes_Ago: number; Current_Date: string; Update_Date: string };
  Rates: Record<string, TruncgilRate>;
};

// =====================  Sources  =====================

const SOURCE_TIMEOUT_MS = 6000;

async function fetchTruncgil(): Promise<TruncgilResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SOURCE_TIMEOUT_MS);
  try {
    const res = await fetch("https://finance.truncgil.com/api/today.json", {
      signal: ctrl.signal,
      headers: { "User-Agent": "kuyumcu-tv/1.0" },
    });
    if (!res.ok) throw new Error(`truncgil ${res.status}`);
    const data = (await res.json()) as TruncgilResponse;
    if (!data?.Rates || typeof data.Rates !== "object") {
      throw new Error("truncgil: malformed response");
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

type YahooQuote = { price: number; changePct: number };

async function fetchYahoo(symbol: string): Promise<YahooQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1m&range=1d`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SOURCE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`yahoo ${symbol} ${res.status}`);
    const data: any = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error(`yahoo ${symbol}: no meta`);
    const price: number = meta.regularMarketPrice;
    const prev: number = meta.previousClose ?? meta.chartPreviousClose;
    if (typeof price !== "number" || typeof prev !== "number") {
      throw new Error(`yahoo ${symbol}: bad numbers`);
    }
    const changePct = prev !== 0 ? ((price - prev) / prev) * 100 : 0;
    return { price, changePct };
  } finally {
    clearTimeout(timer);
  }
}

const fetchOnsAltin = () => fetchYahoo("GC=F");

// =====================  Normalize  =====================

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

function round(n: number | null, decimals: number): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function buildItems(
  truncgil: TruncgilResponse,
  ons: { price: number; changePct: number } | null,
): PriceItem[] {
  const items: PriceItem[] = [];

  if (ons) {
    items.push({
      code: "ONS",
      name: "Ons Altın",
      subText: "USD / ons",
      group: "uluslararasi",
      buy: null,
      sell: round(ons.price, 2),
      change: round(ons.changePct, 2) ?? 0,
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
      change: round(usd.change, 2) ?? 0,
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
      change: round(eur.change, 2) ?? 0,
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
      change: round(gbp.change, 2) ?? 0,
    });
  }

  const has = pickRate(truncgil, "HAS");
  if (has) {
    items.push({
      code: "HAS",
      name: "Has Altın",
      subText: "24 AYAR · 995/1000",
      group: "gram",
      buy: round(has.buy, 2),
      sell: round(has.sell, 2),
      change: round(has.change, 2) ?? 0,
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
        change: round(has.change, 2) ?? 0,
      });
      items.push({
        code: "AYR21",
        name: "21 Ayar",
        subText: "875/1000 · hesaplanan",
        group: "gram",
        buy: round(has.buy * PURITY_21A, 2),
        sell: round(has.sell * PURITY_21A, 2),
        change: round(has.change, 2) ?? 0,
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
      change: round(ayr18.change, 2) ?? 0,
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
      change: round(ayr14.change, 2) ?? 0,
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
      change: round(gumus.change, 2) ?? 0,
    });
  }

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
      change: round(r.change, 2) ?? 0,
    });
  }

  return items;
}

function buildResponse(
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

// =====================  Cache + handler  =====================

const CACHE_TTL_MS = 2500;
const STALE_THRESHOLD_MS = 30_000;

type CachedSnapshot = { response: PricesResponse; fetchedAt: number };

let cached: CachedSnapshot | null = null;
let inflight: Promise<CachedSnapshot> | null = null;

async function refresh(): Promise<CachedSnapshot> {
  const [truncgil, ons] = await Promise.allSettled([
    fetchTruncgil(),
    fetchOnsAltin(),
  ]);
  if (truncgil.status !== "fulfilled") {
    throw new Error(
      `truncgil failed: ${truncgil.reason instanceof Error ? truncgil.reason.message : truncgil.reason}`,
    );
  }
  const onsValue =
    ons.status === "fulfilled"
      ? { price: ons.value.price, changePct: ons.value.changePct }
      : null;
  const source = onsValue ? "truncgil+yahoo" : "truncgil";
  const response = buildResponse(truncgil.value, onsValue, source);
  return { response, fetchedAt: Date.now() };
}

async function getPrices(): Promise<CachedSnapshot> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const fresh = await refresh();
      cached = fresh;
      return fresh;
    } finally {
      inflight = null;
    }
  })();

  try {
    return await inflight;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

const app = new Hono();
app.use("/*", cors());

app.get("/", (c) =>
  c.json({
    name: "kuyumcu-backend",
    status: "ok",
    cachedAt: cached?.response.updatedAt ?? null,
  }),
);

app.get("/api/prices", async (c) => {
  try {
    const snap = await getPrices();
    const ageMs = Date.now() - snap.fetchedAt;
    const isStale = ageMs > STALE_THRESHOLD_MS;
    return c.json(
      {
        ...snap.response,
        online: !isStale,
        ageSeconds: Math.round(ageMs / 1000),
      },
      200,
      {
        "Cache-Control":
          "public, max-age=0, s-maxage=2, stale-while-revalidate=10",
      },
    );
  } catch (err) {
    return c.json(
      {
        error: "fetch_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      503,
    );
  }
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    cached: !!cached,
    lastFetchAt: cached ? new Date(cached.fetchedAt).toISOString() : null,
    ageSeconds: cached
      ? Math.round((Date.now() - cached.fetchedAt) / 1000)
      : null,
  }),
);

export default handle(app);
