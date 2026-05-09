import type { TruncgilResponse } from "../types.js";

const URL = "https://finance.truncgil.com/api/today.json";
const TIMEOUT_MS = 6000;

export async function fetchTruncgil(): Promise<TruncgilResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL, {
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
