import {
  TrendingUp,
  Home,
  PiggyBank,
  Handshake,
  CalendarCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const FEATURE_KEYS = [
  "plan",
  "portfolio",
  "home",
  "accounts",
  "broker",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_META: Record<
  FeatureKey,
  { label: string; short: string; icon: LucideIcon }
> = {
  plan: { label: "Your monthly action plan", short: "Plan", icon: CalendarCheck },
  portfolio: { label: "Your portfolio", short: "Portfolio", icon: TrendingUp },
  home: { label: "Your home", short: "Home", icon: Home },
  accounts: { label: "Recommended accounts", short: "Accounts", icon: PiggyBank },
  broker: { label: "Broker waitlist", short: "Broker", icon: Handshake },
};
