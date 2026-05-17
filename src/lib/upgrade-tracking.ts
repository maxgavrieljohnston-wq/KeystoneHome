// Lightweight client-side helper for logging upgrade-funnel events.
// Calls the SECURITY DEFINER `log_upgrade_event` RPC (anon-callable).
// Fire-and-forget — never throws.

import { supabase } from "@/integrations/supabase/client";

export type UpgradeSource =
  | "paywall_plus"
  | "paywall_pro_link"
  | "paywall_pro_card"
  | "inline_nudge"
  | "sticky_bar"
  | "modal_plus"
  | "modal_pro";

export type UpgradeEventType = "cta_click" | "checkout_open" | "checkout_success";

const SESSION_KEY = "keystone_track_session";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export async function trackUpgradeEvent(args: {
  event_type: UpgradeEventType;
  source: UpgradeSource | string;
  tier: "plus" | "pro";
  email?: string | null;
  plan_id?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId();
    await (supabase as any).rpc("log_upgrade_event", {
      p_event_type: args.event_type,
      p_source: args.source,
      p_tier: args.tier,
      p_session_id: sessionId || null,
      p_email: args.email ?? null,
      p_plan_id: args.plan_id ?? null,
      p_metadata: args.metadata ?? {},
    });
  } catch (err) {
    // Tracking must never break the UI.
    // eslint-disable-next-line no-console
    console.warn("[upgrade-tracking] log failed", err);
  }
}
