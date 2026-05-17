In `src/routes/index.tsx` homepage pricing teaser (around lines 2151-2191):

1. Change the "Unlock everything" button to read **"Compare plans"** and navigate to `/pricing` (use `<Link to="/pricing">` styled like the current button) instead of calling `onStart`.
2. Remove the separate "Compare plans →" link below the bonus footnote.

The "Bonus: Pro ($11/mo) adds Auto-Investing." line stays.