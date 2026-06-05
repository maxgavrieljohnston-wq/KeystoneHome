## Homebuyer readiness panel — redesign

Rework Section 04 on the results page. Two problems today:
- The "Helping you" / "Slowing you down" lists are derived from the same 5 factors (top 3 vs bottom 3), so the same factor often appears in both columns.
- Reason copy is generic ("Debt load leaves room to borrow") and never references the user's actual numbers.

### New layout

Replace the two bulleted lists with a single ranked factor table. The score + label header stays.

```text
┌─────────────────────────────────────────────┐
│ 72   OUT OF 100                             │
│      Almost there                           │
│                                             │
│ A snapshot of how close you are to a        │
│ confident offer — not a credit score.       │
│                                             │
│ ─────────────────────────────────────────── │
│ CREDIT          ████████████░░  ✓ Strong    │
│   740 — top tier for rate pricing           │
│                                             │
│ DEBT-TO-INCOME  ██████░░░░░░░░  ⚠ Tight     │
│   47% back-end — above the 43% lender cap   │
│                                             │
│ DOWN PAYMENT    █████████░░░░░  ✓ On track  │
│   $32k saved — 68% of your $47k target      │
│                                             │
│ TIMELINE        ████████░░░░░░  ✓ Healthy   │
│   3 yrs — enough runway for compounding     │
│                                             │
│ EMPLOYMENT      ████████████░░  ✓ Stable    │
│   W-2 income — straightforward to document  │
└─────────────────────────────────────────────┘
```

Each row: factor label (mono caps) · thin progress bar tinted by score (sage / gold / ember) · short status chip · one-line specific read tied to the user's numbers.

Sort rows by score ascending so the biggest drags are at the top — no separate "slowing you down" section needed; weak rows are visually obvious from bar length + ember tint, and they're surfaced first.

### Reason copy (specific & numeric)

Each row's one-liner pulls from real plan data. Approximate phrasing per factor and tier:

- **Credit**
  - strong (≥740): `{score} — top tier for rate pricing`
  - mid (680–739): `{score} — qualifies, but rates step up below 740`
  - weak (<680): `{score} — under 680, expect higher rates and stricter terms`
- **DTI** (uses same back-end DTI as Section 2)
  - strong (≤36%): `{dti}% back-end — well inside the 43% lender cap`
  - mid (36–43%): `{dti}% back-end — inside the 43% cap with little room`
  - weak (>43%): `{dti}% back-end — above the 43% lender cap`
- **Down payment**
  - fully funded: `${saved} saved — fully funded`
  - on track (≥50% of target): `${saved} saved — {pct}% of your ${target} target`
  - building (<50%): `${saved} saved — {pct}% of your ${target} target, {gap} to go`
- **Timeline**
  - ≥3 yrs: `{years} yrs — enough runway for compounding`
  - 1–3 yrs: `{years} yrs — workable, but compounding is limited`
  - <1 yr: `{years} yrs — short runway, plan leans on cash savings`
- **Employment**
  - stable: `Steady W-2 income — straightforward to document`
  - variable: `Variable income — expect extra documentation (2 yrs of returns)`

Status chip ("Strong / Healthy / Tight / Low / Stable / Variable") is derived from the same tier so the chip and the sentence agree.

### Scope

- Only edits `ReadinessPanel` and its caller in `src/routes/index.tsx` (pass through the extra numeric props it needs: `creditScoreValue`, `dtiPct`, `saved`, `downPayment`, `timelineYears`, `incomeFactor`).
- No changes to the readiness score formula, to data, or to any other section.
- No backend or server-fn changes.

### Out of scope

- Recomputing factor weights.
- Rewriting the "snapshot of how close you are…" intro line.
- Touching the paywall component beneath it.
