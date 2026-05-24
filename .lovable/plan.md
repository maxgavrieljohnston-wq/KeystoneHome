# Polish the downloadable PDF

Scope: keep the single-page editorial layout in `src/lib/plan-pdf.server.ts`. Make it tighter, more visual, and consistent with the rest of the app.

## Changes

### 1. Fix overflow & layout discipline
- Reduce row line-height (17 → 15) and section gaps so all 6 sections fit reliably even with goal block + all optional rows.
- Add a real bottom guard: if a section would cross y=80, drop the lowest-priority optional rows (e.g. profile snapshot's expenses/debt) instead of overlapping the footer.
- Tighten section header spacing.

### 2. Readiness gauge (replaces the plain "Score" row in section 04)
- Horizontal 0–100 track ~220px wide with three color zones (ember 0–39, gold 40–59, sage 60–100), filled to the user's score, with a tick marker and the numeric "{score} / 100 — {label}" beside it.
- Drawn with `page.drawRectangle` — no new dependency.

### 3. Save-vs-invest comparison chart (replaces the two scalar rows in section 03)
- Four horizontal bars, one per tier: Conservative, Moderate, Balanced, Growth (rates pulled from the same `RISK_PROFILES` source used by `InvestVsSavePanel` so they stay in sync).
- Each bar shows `$/mo needed` for the same deposit + timeline, labeled with rate and dollar amount. Bar widths scale to the largest (Save-only / Conservative).
- Highlight the user's currently-selected tier (from `assumptions.expectedReturnPct`) with the ember accent; others in faint.
- Keep "Already saved" and "Target deposit" as the two summary rows above the chart.

### 4. Personalize "Next steps" (section 05)
Derive bullets from the user's actual numbers instead of the current near-static list:
- If `housingRatio > 0.36`: lead with "Lower your target price to ~{X} to bring housing under 36% of income."
- If `dti > 0.43`: "Pay down {money(debtToReduce)} of debt to qualify comfortably."
- If `credit < 680`: "Raise your credit score above 680 — biggest rate impact."
- If `timelineYears < 3`: keep-in-cash bullet; else surface the active investment tier's $/mo.
- If `g.requiredMonthly > m.monthlyToSave * 1.2`: "Your goal date requires {money(required)}/mo — consider extending move-in by {N} months."
- Always end with the 6-month re-check bullet.
Cap at 4 bullets; wrap as today.

### 5. Footer + small fixes
- Change footer URL from `keystonehomeowner.lovable.app` to `keystonehomeowners.com`.
- Add a small "Page 1 of 1" on the right of the footer line (sets up cleanly if we ever go multi-page).
- Fix the `headerRight` label from "THE REPORT" to "HOMEBUYING PLAN" (matches in-app language).

## Files touched
- `src/lib/plan-pdf.server.ts` — all of the above; pure rendering changes, no new deps.
- Import `RISK_PROFILES` (or the equivalent export) from `src/lib/keystone.ts` so tier rates are a single source of truth with the dashboard.

## Out of scope
- Multi-page layout, cover hero, custom fonts, deposit-progress bar, monthly housing breakdown chart, partner breakdown, wishlist section. (Can revisit later.)
- No DB, server-fn signature, or download-button changes.
