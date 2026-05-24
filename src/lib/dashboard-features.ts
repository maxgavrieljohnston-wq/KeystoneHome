import {
  Pencil,
  TrendingUp,
  Sliders,
  Home,
  PiggyBank,
  AlertTriangle,
  Handshake,
  CalendarCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const FEATURE_KEYS = [
  "plan",
  "editable",
  "invest",
  "assumptions",
  "picture",
  "accounts",
  "risk",
  "broker",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_META: Record<
  FeatureKey,
  { label: string; short: string; icon: LucideIcon }
> = {
  plan: { label: "Your monthly action plan", short: "Plan", icon: CalendarCheck },
  editable: { label: "Current finances", short: "Finances", icon: Pencil },
  invest: { label: "Invest vs save", short: "Invest", icon: TrendingUp },
  assumptions: { label: "Assumptions", short: "Tune", icon: Sliders },
  picture: { label: "Picture your place", short: "Picture", icon: Home },
  accounts: { label: "Recommended accounts", short: "Accounts", icon: PiggyBank },
  risk: { label: "Risk scenarios", short: "Risk", icon: AlertTriangle },
  broker: { label: "Broker waitlist", short: "Broker", icon: Handshake },
};
