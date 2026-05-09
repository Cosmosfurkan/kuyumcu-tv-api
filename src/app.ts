import { Hono } from "hono";
import { cors } from "hono/cors";

import { fetchTruncgil } from "./sources/truncgil.js";
import { fetchOnsAltin } from "./sources/yahoo.js";
import { buildResponse } from "./normalize.js";
import type { PricesResponse } from "./types.js";

const CACHE_TTL_MS = 2500;
const STALE_THRESHOLD_MS = 30_000;

type CachedSnapshot = {
  response: PricesResponse;
  fetchedAt: number;
};

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

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

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
        // Edge CDN may serve a fresh response for 2 seconds.
        "Cache-Control": "public, max-age=0, s-maxage=2, stale-while-revalidate=10",
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

app.get("/api/health", async (c) => {
  return c.json({
    ok: true,
    cached: !!cached,
    lastFetchAt: cached ? new Date(cached.fetchedAt).toISOString() : null,
    ageSeconds: cached ? Math.round((Date.now() - cached.fetchedAt) / 1000) : null,
  });
});

export default app;
