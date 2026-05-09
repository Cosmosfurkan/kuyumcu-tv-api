import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchTruncgil } from "./sources/truncgil.js";
import { fetchOnsAltin } from "./sources/yahoo.js";
import { buildResponse } from "./normalize.js";
import type { PricesResponse } from "./types.js";

const POLL_INTERVAL_MS = 3000;
const STALE_THRESHOLD_MS = 30_000;

let cached: PricesResponse | null = null;
let lastSuccessAt = 0;
let consecutiveFailures = 0;

async function refresh(): Promise<void> {
  try {
    const [truncgil, onsResult] = await Promise.allSettled([
      fetchTruncgil(),
      fetchOnsAltin(),
    ]);

    if (truncgil.status !== "fulfilled") {
      throw new Error(`truncgil failed: ${truncgil.reason}`);
    }

    const ons =
      onsResult.status === "fulfilled"
        ? { price: onsResult.value.price, changePct: onsResult.value.changePct }
        : null;

    const source = ons ? "truncgil+yahoo" : "truncgil";
    cached = buildResponse(truncgil.value, ons, source);
    lastSuccessAt = Date.now();
    consecutiveFailures = 0;

    if (process.env.LOG_LEVEL !== "quiet") {
      console.log(
        `[${new Date().toISOString()}] refresh ok · ${cached.items.length} items · ${source}`,
      );
    }
  } catch (err) {
    consecutiveFailures++;
    console.error(
      `[${new Date().toISOString()}] refresh failed (#${consecutiveFailures}):`,
      err instanceof Error ? err.message : err,
    );
  }
}

const app = new Hono();
app.use("/*", cors());

app.get("/", (c) =>
  c.json({
    name: "kuyumcu-backend",
    status: "ok",
    cachedAt: cached?.updatedAt ?? null,
    consecutiveFailures,
  }),
);

app.get("/api/prices", (c) => {
  if (!cached) {
    return c.json({ error: "not_ready" }, 503);
  }
  const ageMs = Date.now() - lastSuccessAt;
  const isStale = ageMs > STALE_THRESHOLD_MS;
  return c.json({
    ...cached,
    online: !isStale,
    ageSeconds: Math.round(ageMs / 1000),
  });
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    cached: !!cached,
    lastSuccessAt: lastSuccessAt ? new Date(lastSuccessAt).toISOString() : null,
    ageSeconds: lastSuccessAt ? Math.round((Date.now() - lastSuccessAt) / 1000) : null,
    consecutiveFailures,
  }),
);

const port = Number(process.env.PORT ?? 8787);

await refresh();
setInterval(refresh, POLL_INTERVAL_MS);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`kuyumcu-backend listening on http://localhost:${info.port}`);
  console.log(`  GET /              health snapshot`);
  console.log(`  GET /api/prices    cached price feed`);
  console.log(`  GET /api/health    detailed health`);
});
