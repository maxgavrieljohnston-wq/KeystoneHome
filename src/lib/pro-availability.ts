// Single source of truth for whether Pro is purchasable.
//
// Flip PRO_COMING_SOON to false when Pro is ready to launch.
// Until then, every Pro purchase CTA renders as "Coming Soon" and the
// server refuses to create a Pro Stripe checkout session — EXCEPT for
// the test emails listed below, which keep full Pro access for QA.
//
// Safe to import from both client and server (emails only — no secrets).

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const PRO_COMING_SOON = true;

/**
 * Emails allowed to purchase / preview Pro while PRO_COMING_SOON is true.
 * Comparison is case-insensitive / trim-insensitive.
 * Add the QA tester address here.
 */
export const PRO_TEST_EMAILS: readonly string[] = [
  // TODO: add your Pro test account email, e.g. "pro-tester@keystone.test"
];

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isProTester(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  if (!e) return false;
  return PRO_TEST_EMAILS.some((t) => normalizeEmail(t) === e);
}

export function isProAvailableFor(email: string | null | undefined): boolean {
  return !PRO_COMING_SOON || isProTester(email);
}

/** Client hook — resolves the current user's email and returns availability. */
export function useProAvailable(): { proAvailable: boolean; isTester: boolean; email: string | null } {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const tester = isProTester(email);
  // While auth is still resolving, assume non-tester to avoid flashing a
  // purchasable CTA to a signed-out user.
  const proAvailable = ready ? !PRO_COMING_SOON || tester : !PRO_COMING_SOON;
  return { proAvailable, isTester: tester, email };
}
