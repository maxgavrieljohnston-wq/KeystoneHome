## Change: Fix minimum monthly contribution to $100 on timeline slider

### Problem
The "How long would it take without an investment account?" slider's minimum is dynamically calculated (`Math.min(fifteenYearMonthly, Math.max(100, Math.floor(maxSave / 100) * 100))`), which can push the floor above $100 depending on the user's finances and goal size.

### Fix
Set `minMonthly` to a flat `$100` instead of the current dynamic expression. The maximum (`sliderMax`) stays unchanged.

### Scope
- File: `src/routes/index.tsx` (around line 1061)
- One-line change: `const minMonthly = 100;`
- `sliderMax`, `stored`, and `monthlySave` clamping logic are untouched.

### Out of scope
- No changes to the maximum logic (`sliderMax`).
- No changes to the slider step, formatting, or on-change behavior.
- No changes to other screens or components.