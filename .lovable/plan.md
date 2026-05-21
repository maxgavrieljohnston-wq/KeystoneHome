
## 1) Expand the "Your numbers" panel (Plus/Pro)

Today `EditablePlanPanel` exposes only 3 fields. Replace it with a full editable view of every input the wizard collected that materially drives the math, pre-populated from the saved plan's `answers` / `current_savings`. Each field debounce-autosaves through the existing `updatePlanMeta` server fn (extending `answersPatch` to accept the additional keys — no schema change, all live in the `answers` JSONB).

Fields, grouped:

- **Home target** — Target home price, ZIP, Home style, Beds, Baths, Down payment goal %
- **Your finances** — Annual income, Monthly debt payments, Credit score, Current savings, Monthly contribution
- **Partner finances** (only if `hasPartner === true`) — Partner annual income, Partner monthly debt, Partner credit score
- **Timeline** — Target timeline (years)

Numeric inputs match the existing `Field` component; the few enums (Home style, Credit bracket) become small `<select>`s seeded from `HOME_STYLES` and the wizard's credit options. ZIP is a text input that revalidates against `getPriceByZip`.

### New bottom metric — "Time saved by investing"

Beneath the inputs, a single highlighted result row computed live from `computePlanMetrics`:

```
Time saved by investing ……… 1 yr 4 mo
Saving alone: 5 yr 2 mo → Investing at 7%: 3 yr 10 mo
```

Math (added as a small helper in `plan-metrics.ts`, no new state):
- `monthsSaveOnly  = ceil((cashToClose - currentSavings) / monthlySavings)`
- `monthsInvested  = solve for n such that FV(currentSavings, monthlySavings, r/12, n) = cashToClose` (closed-form using the existing `calcRequiredMonthly` inverse, or numeric bisection)
- `timeSavedMonths = monthsSaveOnly - monthsInvested`

Edge cases: when `monthlySavings <= 0` or `currentSavings >= cashToClose`, show "—" with helper copy ("Add a monthly contribution to see the boost").

### Revert behavior

Snapshot now captures every editable field on first mount; "Revert to original" restores all of them in one `updatePlanMeta` call.

## 2) Fix the top KPI strip in `PaidHero`

In `src/routes/dashboard.tsx` (lines 305–322), the "no goal" branch currently shows **Monthly income** + **Timeline**. Change to:

- **Monthly savings** — `metrics.monthlySavings` (the user's chosen contribution, pre-investing). If 0, show "—".
- **Timeline (saving only)** — months/years it would take to hit `cashToClose` at `monthlySavings` with **no** investment return, formatted like `4 yr 2 mo`. Uses the same `monthsSaveOnly` helper from §1.

The "has goal" branch is unchanged.

## 3) Remove the panel underneath

In the paid layout (lines 184–192), delete the `<PlansList … hideNewPlanButton />` block so the left column is just `<EditablePlanPanel />`. Plan actions that lived there (PDF, CSV, share, rename, theme, delete) move into a compact action row at the bottom of `EditablePlanPanel` so paid users don't lose them — same handlers (`exportPlanPdf`, `exportPlanCsv`, `togglePlanShare`, `renamePlan`, `deletePlan`, `updatePlanMeta` for theme) already imported in `dashboard.tsx` get passed in or re-imported in the panel.

`PlansList`, `hideNewPlanButton`, `handleNewPlan`, and `FREE_LIMIT` stay intact for the free-user branch.

## Technical notes

- **Files touched:**
  - `src/components/dashboard/EditablePlanPanel.tsx` — full rewrite of the form; add select inputs, partner section, timeline, and the time-saved result row; embed plan action buttons.
  - `src/lib/plan-metrics.ts` — add `computeTimeToGoal({ cashToClose, currentSavings, monthlySavings, annualReturnRate })` returning `{ monthsSaveOnly, monthsInvested, timeSavedMonths }`. Pure function, no side effects.
  - `src/lib/plans.functions.ts` — extend `updateMetaSchema.answersPatch` to accept the new keys: `timelineYears`, `downGoalPct`, `income`, `partnerIncome`, `debt`, `partnerDebt`, `credit`, `partnerCredit`, `zip`, `homeStyle`, `beds`, `baths`, `hasPartner`. When `zip` changes, also refresh `answers.zipData` via `getPriceByZip` so downstream metrics use the right metro.
  - `src/routes/dashboard.tsx` — swap the "Monthly income / Timeline" KPIs for "Monthly savings / Timeline (saving only)"; delete the second `<PlansList>` in the paid left column.

- **No DB migration.** All new fields already live in the `answers` JSONB.
- **No change to `exportPlanPdf` / `exportPlanCsv`.** They already re-read `answers` + `assumptions` + `current_savings`.
- The wizard's free flow is untouched — free users still see the old `PlansList` and `+ Build new plan` button.
