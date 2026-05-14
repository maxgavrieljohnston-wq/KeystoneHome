// US states + DC with reasonable 2025 median single-family home prices.
// These are conservative, sourced from blended 2024–2025 NAR / Zillow /
// Redfin medians and rounded to the nearest $5k. Adjust as needed.

export type StateRow = {
  code: string; // 2-letter postal code (also stored in d.zip for backward compat)
  name: string;
  region: "Northeast" | "Midwest" | "South" | "West";
  median: number; // typical single-family home price
};

export const US_STATES: StateRow[] = [
  { code: "AL", name: "Alabama",        region: "South",     median: 230000 },
  { code: "AK", name: "Alaska",         region: "West",      median: 380000 },
  { code: "AZ", name: "Arizona",        region: "West",      median: 440000 },
  { code: "AR", name: "Arkansas",       region: "South",     median: 210000 },
  { code: "CA", name: "California",     region: "West",      median: 790000 },
  { code: "CO", name: "Colorado",       region: "West",      median: 580000 },
  { code: "CT", name: "Connecticut",    region: "Northeast", median: 425000 },
  { code: "DE", name: "Delaware",       region: "South",     median: 380000 },
  { code: "DC", name: "District of Columbia", region: "South", median: 620000 },
  { code: "FL", name: "Florida",        region: "South",     median: 410000 },
  { code: "GA", name: "Georgia",        region: "South",     median: 340000 },
  { code: "HI", name: "Hawaii",         region: "West",      median: 850000 },
  { code: "ID", name: "Idaho",          region: "West",      median: 470000 },
  { code: "IL", name: "Illinois",       region: "Midwest",   median: 270000 },
  { code: "IN", name: "Indiana",        region: "Midwest",   median: 240000 },
  { code: "IA", name: "Iowa",           region: "Midwest",   median: 220000 },
  { code: "KS", name: "Kansas",         region: "Midwest",   median: 230000 },
  { code: "KY", name: "Kentucky",       region: "South",     median: 230000 },
  { code: "LA", name: "Louisiana",      region: "South",     median: 235000 },
  { code: "ME", name: "Maine",          region: "Northeast", median: 380000 },
  { code: "MD", name: "Maryland",       region: "South",     median: 420000 },
  { code: "MA", name: "Massachusetts",  region: "Northeast", median: 605000 },
  { code: "MI", name: "Michigan",       region: "Midwest",   median: 250000 },
  { code: "MN", name: "Minnesota",      region: "Midwest",   median: 340000 },
  { code: "MS", name: "Mississippi",    region: "South",     median: 200000 },
  { code: "MO", name: "Missouri",       region: "Midwest",   median: 245000 },
  { code: "MT", name: "Montana",        region: "West",      median: 470000 },
  { code: "NE", name: "Nebraska",       region: "Midwest",   median: 250000 },
  { code: "NV", name: "Nevada",         region: "West",      median: 440000 },
  { code: "NH", name: "New Hampshire",  region: "Northeast", median: 480000 },
  { code: "NJ", name: "New Jersey",     region: "Northeast", median: 525000 },
  { code: "NM", name: "New Mexico",     region: "West",      median: 320000 },
  { code: "NY", name: "New York",       region: "Northeast", median: 480000 },
  { code: "NC", name: "North Carolina", region: "South",     median: 340000 },
  { code: "ND", name: "North Dakota",   region: "Midwest",   median: 260000 },
  { code: "OH", name: "Ohio",           region: "Midwest",   median: 230000 },
  { code: "OK", name: "Oklahoma",       region: "South",     median: 220000 },
  { code: "OR", name: "Oregon",         region: "West",      median: 500000 },
  { code: "PA", name: "Pennsylvania",   region: "Northeast", median: 270000 },
  { code: "RI", name: "Rhode Island",   region: "Northeast", median: 470000 },
  { code: "SC", name: "South Carolina", region: "South",     median: 310000 },
  { code: "SD", name: "South Dakota",   region: "Midwest",   median: 290000 },
  { code: "TN", name: "Tennessee",      region: "South",     median: 340000 },
  { code: "TX", name: "Texas",          region: "South",     median: 335000 },
  { code: "UT", name: "Utah",           region: "West",      median: 530000 },
  { code: "VT", name: "Vermont",        region: "Northeast", median: 400000 },
  { code: "VA", name: "Virginia",       region: "South",     median: 405000 },
  { code: "WA", name: "Washington",     region: "West",      median: 620000 },
  { code: "WV", name: "West Virginia",  region: "South",     median: 175000 },
  { code: "WI", name: "Wisconsin",      region: "Midwest",   median: 280000 },
  { code: "WY", name: "Wyoming",        region: "West",      median: 360000 },
];

const BY_CODE = new Map(US_STATES.map((s) => [s.code, s]));

export function stateByCode(code: string): StateRow | undefined {
  return BY_CODE.get(code.toUpperCase());
}

export function priceByState(code: string): { city: string; avg: number } {
  const s = stateByCode(code);
  if (s) return { city: s.name, avg: s.median };
  return { city: "your area", avg: 400000 };
}
