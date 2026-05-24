import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const email = `pro-test-${Date.now()}@keystone.test`;
const password = "ProTest123!";

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Pro Test User" },
});
if (error) { console.error(error); process.exit(1); }

const userId = data.user!.id;
console.log("Created user:", userId, email);

// Seed subscription rows in BOTH environments to cover sandbox+live preview
const periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const periodStart = new Date().toISOString();
for (const environment of ["sandbox", "live"] as const) {
  const { error: subErr } = await admin.from("subscriptions").insert({
    user_id: userId,
    price_id: "pro_yearly",
    product_id: `prod_demo_${environment}`,
    status: "active",
    environment,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: false,
    stripe_customer_id: `cus_demo_${environment}_${userId.slice(0,8)}`,
    stripe_subscription_id: `sub_demo_${environment}_${userId.slice(0,8)}`,
  });
  if (subErr) { console.error(environment, subErr); process.exit(1); }
}

// Seed a basic profile/answers so the dashboard isn't empty
const answers = {
  firstName: "Pro",
  lastName: "Tester",
  email,
  targetCity: "Austin",
  targetState: "TX",
  priceMin: 400000,
  priceMax: 600000,
  timeline: "6-12 months",
  creditBand: "740-799",
  income: 150000,
  currentSavings: 80000,
};
const { error: planErr } = await admin.from("plans").insert({
  email,
  user_id: userId,
  answers,
  initial_answers: answers,
  first_name: "Pro",
  last_name: "Tester",
  title: "Austin Home Plan",
});
if (planErr) console.error("plan:", planErr);

console.log("\n=== Pro test account ready ===");
console.log("Email:    ", email);
console.log("Password: ", password);
console.log("User ID:  ", userId);
