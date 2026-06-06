## Remove the "Risk scenarios" dashboard feature

### Changes
1. **`src/lib/dashboard-features.ts`** — remove `"risk"` from `FEATURE_KEYS` and delete the `risk: { label: "Risk scenarios", ... }` entry from `FEATURE_META`. Also drop the now-unused `AlertTriangle` import.
2. **`src/routes/features.$key.tsx`** — remove the `import { RiskScenariosPanel }` line and delete the `case "risk":` branch from the panel switch.
3. **`src/components/dashboard/RiskScenariosPanel.tsx`** — delete the file.

### Out of scope (leaving alone)
- Onboarding's risk-tolerance questionnaire (`RISK_QS`, `riskAnswers`, `deriveRisk`) in `src/routes/index.tsx` — a separate feature used to build the investing profile, not the dashboard "Risk scenarios" panel.
- Mentions of "market risk" / "de-risk" in the PDF generators (`plan-pdf.server.ts`, `investment-pdf.functions.ts`) — unrelated copy about timeline risk.

The feature icon bar and dashboard automatically pick up the trimmed `FEATURE_KEYS`, so no further wiring is needed.