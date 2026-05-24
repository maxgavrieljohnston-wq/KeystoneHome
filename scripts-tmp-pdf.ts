import { buildPlanPdfBytes } from "@/lib/plan-pdf.server";
import { writeFileSync } from "fs";
const out = await buildPlanPdfBytes({
  id: "x", email: "user@example.com", title: null,
  answers: {
    firstName: "Alex", lastName: "Doe", city: "Austin", zip: "78704",
    income: 95000, expenses: 2200, debt: 450, credit: 690,
    hasPartner: true, partnerIncome: 60000, partnerExpenses: 0, partnerDebt: 200, partnerCredit: 660,
    targetPrice: 480000, downPct: 10, timelineYears: 5, monthlySavings: 1200,
  },
  assumptions: { expectedReturnPct: 7, mortgageRatePct: 6.75 },
  theme: "light", target_move_in: "2028-08-01", current_savings: 18000,
});
writeFileSync("/tmp/out.pdf", out.bytes);
console.log("wrote", out.filename, out.bytes.length);
