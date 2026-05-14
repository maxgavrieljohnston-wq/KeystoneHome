// Curated account recommendations shown to Plus members.
// Currently empty — to be populated with vetted HYSAs, brokerages, and
// robo-advisors. The dashboard renders a "coming soon" placeholder when
// this list is empty.

export type AccountKind = "hysa" | "brokerage" | "robo" | "cd";

export type RecommendedAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  apyOrReturn: string;        // display only, e.g. "4.35% APY"
  bestForTimelineYears: [number, number]; // inclusive range
  blurb: string;              // 1-2 sentence pitch
  url: string;                // (eventually affiliate) link
  highlights: string[];       // 2-4 bullet points
};

export const RECOMMENDED_ACCOUNTS: RecommendedAccount[] = [];
