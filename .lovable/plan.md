## Change
Remove the "Expected investment return" input field from the Tune Your Assumptions panel (`src/components/dashboard/AssumptionsPanel.tsx`).

### What
- Remove `expectedReturnPct` from the `Field` type union (line 27).
- Remove the entire `expectedReturnPct` object from the `FIELDS` array (lines 76–82).

This drops the last row in the assumptions form while leaving the other 5 fields untouched. No other files need changes.