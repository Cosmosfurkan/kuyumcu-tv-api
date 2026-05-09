const TIMEOUT_MS = 6000;

type YahooQuote = {
  price: number;
  previousClose: number;
  changePct: number;
};

async function fetchYahoo(symbol: string): Promise<YahooQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
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
    return { price, previousClose: prev, changePct };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOnsAltin(): Promise<YahooQuote> {
  return fetchYahoo("GC=F");
}

export async function fetchUsdTry(): Promise<YahooQuote> {
  return fetchYahoo("USDTRY=X");
}
