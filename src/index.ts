import { serve } from "@hono/node-server";

import app from "./app.js";

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`kuyumcu-backend listening on http://localhost:${info.port}`);
  console.log(`  GET /              health snapshot`);
  console.log(`  GET /api/prices    cached price feed`);
  console.log(`  GET /api/health    detailed health`);
});
