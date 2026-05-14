// Popular US metros for the ZIP screen quick-pick.
// Each entry maps a representative ZIP that getPriceByZip() recognizes.
export type Metro = {
  city: string;
  zip: string;
  // Optional Plus-tier defaults the report can use as assumption presets.
  propertyTaxRate?: number; // annual % of price
  insuranceRate?: number;   // annual % of price
};

export const POPULAR_METROS: Metro[] = [
  { city: "New York, NY",     zip: "10001", propertyTaxRate: 0.0188, insuranceRate: 0.0042 },
  { city: "Los Angeles, CA",  zip: "90001", propertyTaxRate: 0.0072, insuranceRate: 0.0055 },
  { city: "Chicago, IL",      zip: "60601", propertyTaxRate: 0.0227, insuranceRate: 0.0048 },
  { city: "Houston, TX",      zip: "77001", propertyTaxRate: 0.0181, insuranceRate: 0.0179 },
  { city: "Phoenix, AZ",      zip: "85001", propertyTaxRate: 0.0062, insuranceRate: 0.0054 },
  { city: "Philadelphia, PA", zip: "19101", propertyTaxRate: 0.0148, insuranceRate: 0.0048 },
  { city: "Dallas, TX",       zip: "75201", propertyTaxRate: 0.0181, insuranceRate: 0.0179 },
  { city: "San Jose, CA",     zip: "95101", propertyTaxRate: 0.0072, insuranceRate: 0.0055 },
  { city: "Atlanta, GA",      zip: "30301", propertyTaxRate: 0.0093, insuranceRate: 0.0067 },
  { city: "Denver, CO",       zip: "80201", propertyTaxRate: 0.0051, insuranceRate: 0.0080 },
  { city: "Nashville, TN",    zip: "37201", propertyTaxRate: 0.0067, insuranceRate: 0.0061 },
  { city: "Seattle, WA",      zip: "98101", propertyTaxRate: 0.0088, insuranceRate: 0.0048 },
  { city: "Charlotte, NC",    zip: "28201", propertyTaxRate: 0.0084, insuranceRate: 0.0055 },
  { city: "Tampa, FL",        zip: "33601", propertyTaxRate: 0.0098, insuranceRate: 0.0193 },
  { city: "Miami, FL",        zip: "33101", propertyTaxRate: 0.0098, insuranceRate: 0.0193 },
  { city: "Boston, MA",       zip: "02101", propertyTaxRate: 0.0117, insuranceRate: 0.0048 },
  { city: "Washington, DC",   zip: "20001", propertyTaxRate: 0.0056, insuranceRate: 0.0048 },
  { city: "Detroit, MI",      zip: "48201", propertyTaxRate: 0.0164, insuranceRate: 0.0078 },
];

export function metroByZip(zip: string): Metro | undefined {
  if (!zip || zip.length < 3) return undefined;
  const prefix = zip.slice(0, 3);
  return POPULAR_METROS.find((m) => m.zip.startsWith(prefix));
}
