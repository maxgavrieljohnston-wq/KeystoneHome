// Market intelligence — pulls city-level housing & income stats from the
// public Census Bureau ACS 5-year estimates API (no key required) and
// caches the result in `market_snapshots` for 24h.
//
// Stats:
// - B25077_001E: Median value (dollars) for owner-occupied housing units
// - B19013_001E: Median household income in the past 12 months

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
  IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
  MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
  NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
  TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
  WI: "55", WY: "56",
};

const ACS_YEAR = "2022";
const CACHE_HOURS = 24;

type MarketPayload = {
  matchedName: string;
  medianHomeValue: number | null;
  medianHouseholdIncome: number | null;
  priceToIncome: number | null;
  verdict: "Affordable" | "Stretched" | "Unaffordable" | "Unknown";
  source: string;
  asOf: string;
};

function verdictFor(ratio: number | null): MarketPayload["verdict"] {
  if (ratio == null || !isFinite(ratio)) return "Unknown";
  if (ratio <= 3.5) return "Affordable";
  if (ratio <= 5.5) return "Stretched";
  return "Unaffordable";
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\b(city|town|village|borough|cdp|municipality)\b/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchFromCensus(city: string, state: string): Promise<MarketPayload> {
  const stateUpper = state.trim().toUpperCase();
  const fips = STATE_FIPS[stateUpper];
  if (!fips) {
    throw new Error(`Unknown US state code: ${state}. Use a 2-letter code (e.g. "TX").`);
  }

  const url = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?get=NAME,B25077_001E,B19013_001E&for=place:*&in=state:${fips}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Census API error: ${res.status}`);
  }
  const rows = (await res.json()) as string[][];
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error("Census returned no data");
  }
  // First row is headers
  const wantNorm = normalize(city);
  let best: string[] | null = null;
  let bestScore = -1;
  for (let i = 1; i < rows.length; i++) {
    const name = rows[i][0] || "";
    // Census names look like "Austin city, Texas"
    const cityPart = name.split(",")[0] || "";
    const norm = normalize(cityPart);
    if (norm === wantNorm) {
      best = rows[i];
      break;
    }
    // Loose match: starts with or contains
    let score = 0;
    if (norm.startsWith(wantNorm)) score = 90;
    else if (norm.includes(wantNorm)) score = 70;
    else if (wantNorm.includes(norm) && norm.length > 3) score = 60;
    if (score > bestScore) {
      bestScore = score;
      best = rows[i];
    }
  }
  if (!best || bestScore < 60) {
    throw new Error(`Couldn't find "${city}, ${stateUpper}" in Census data. Try a nearby larger city.`);
  }
  const matchedName = best[0] || `${city}, ${stateUpper}`;
  const medianHomeValue = Number(best[1]);
  const medianHouseholdIncome = Number(best[2]);
  const homeValOk = isFinite(medianHomeValue) && medianHomeValue > 0;
  const incomeOk = isFinite(medianHouseholdIncome) && medianHouseholdIncome > 0;
  const priceToIncome = homeValOk && incomeOk ? medianHomeValue / medianHouseholdIncome : null;

  return {
    matchedName,
    medianHomeValue: homeValOk ? medianHomeValue : null,
    medianHouseholdIncome: incomeOk ? medianHouseholdIncome : null,
    priceToIncome,
    verdict: verdictFor(priceToIncome),
    source: `U.S. Census Bureau, ACS 5-Year ${ACS_YEAR}`,
    asOf: new Date().toISOString(),
  };
}

export const getMarketSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        city: z.string().min(1).max(80),
        state: z.string().min(2).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const cityKey = data.city.trim();
    const stateKey = data.state.trim().toUpperCase();

    // Cache lookup
    const { data: cached } = await supabaseAdmin
      .from("market_snapshots")
      .select("payload, fetched_at")
      .ilike("city", cityKey)
      .ilike("state", stateKey)
      .maybeSingle();

    if (cached) {
      const ageHours = (Date.now() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60);
      if (ageHours < CACHE_HOURS) {
        return { snapshot: cached.payload as MarketPayload, cached: true };
      }
    }

    let payload: MarketPayload;
    try {
      payload = await fetchFromCensus(cityKey, stateKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch market data";
      return { snapshot: null, cached: false, error: msg };
    }

    await supabaseAdmin
      .from("market_snapshots")
      .upsert(
        { city: cityKey, state: stateKey, payload, fetched_at: new Date().toISOString() },
        { onConflict: "city,state" },
      );

    return { snapshot: payload, cached: false };
  });
