/**
 * Seed 5 test accounts with diverse personas + pre-built plans.
 *
 * Run: bun scripts/seed-test-accounts.ts
 *
 * Idempotent: deletes existing test users (by email) and recreates them.
 * NOT shipped to prod — lives in scripts/, never imported by app code.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "KeystoneTest!2026";

type Tier = "free" | "plus" | "pro";

type Persona = {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  blurb: string;
  tier: Tier;
  answers: Record<string, unknown>;
};

const personas: Persona[] = [
  {
    email: "test1@keystone.test",
    displayName: "Maya Chen",
    firstName: "Maya",
    lastName: "Chen",
    blurb: "26, single renter in Austin — 4-yr runway to a 1BR condo (~$340k)",
    tier: "free",
    answers: {
      age: 26,
      firstName: "Maya",
      lastName: "Chen",
      email: "test1@keystone.test",
      phone: "5125550101",
      zip: "TX",
      zipData: { avg: 340000, city: "Austin" },
      income: 72000,
      expenses: 2400,
      debt: 5200,
      saved: 4800,
      credit: 712,
      employment: "w2",
      hasPartner: false,
      partnerAge: 0,
      partnerEmail: "",
      partnerFirstName: "",
      partnerLastName: "",
      partnerIncome: 0,
      partnerExpenses: 0,
      partnerDebt: 0,
      partnerSaved: 0,
      partnerCredit: null,
      partnerEmployment: null,
      homeStyle: "condo",
      homeLayout: "onestory",
      beds: 1,
      baths: 1,
      parking: "street",
      outdoorSpace: "none",
      lifestyle: { nightlife: "nice", coffee: "nice" },
      neighborhood: { transit: "nice", nightlife: "nice" },
      timelineYears: 4,
      timelineBucket: "$500",
      downGoalPct: 10,
      riskAnswers: { "0": 3, "1": 3, "2": 2, "3": 3 },
      assumptions: {},
    },
  },
  {
    email: "test2@keystone.test",
    displayName: "Marcus & Tina Rivera",
    firstName: "Marcus",
    lastName: "Rivera",
    blurb: "31 + 30 couple in Charlotte — 2.5-yr push for a 3BR townhouse (~$410k)",
    tier: "plus",
    answers: {
      age: 31,
      firstName: "Marcus",
      lastName: "Rivera",
      email: "test2@keystone.test",
      phone: "7045550102",
      zip: "NC",
      zipData: { avg: 410000, city: "Charlotte" },
      income: 82000,
      expenses: 2400,
      debt: 12000,
      saved: 19000,
      credit: 735,
      employment: "w2",
      hasPartner: true,
      partnerAge: 30,
      partnerFirstName: "Tina",
      partnerLastName: "Rivera",
      partnerEmail: "tina.test2@keystone.test",
      partnerIncome: 63000,
      partnerExpenses: 1700,
      partnerDebt: 6000,
      partnerSaved: 13000,
      partnerCredit: 720,
      partnerEmployment: "w2",
      homeStyle: "townhouse",
      homeLayout: "twostory",
      beds: 3,
      baths: 2,
      parking: "driveway",
      outdoorSpace: "patio",
      lifestyle: { dog: "nice", garden: "nice" },
      neighborhood: { schools: "nice", quiet: "nice" },
      timelineYears: 3,
      timelineBucket: "$1500",
      downGoalPct: 15,
      riskAnswers: { "0": 2, "1": 3, "2": 2, "3": 2 },
      assumptions: {},
    },
  },
  {
    email: "test3@keystone.test",
    displayName: "Priya Shah",
    firstName: "Priya",
    lastName: "Shah",
    blurb: "38, high-income single in Seattle — ~1 yr from a 2BR condo (~$680k)",
    tier: "pro",
    answers: {
      age: 38,
      firstName: "Priya",
      lastName: "Shah",
      email: "test3@keystone.test",
      phone: "2065550103",
      zip: "WA",
      zipData: { avg: 680000, city: "Seattle" },
      income: 215000,
      expenses: 5800,
      debt: 0,
      saved: 95000,
      credit: 798,
      employment: "w2",
      hasPartner: false,
      partnerAge: 0,
      partnerFirstName: "",
      partnerLastName: "",
      partnerEmail: "",
      partnerIncome: 0,
      partnerExpenses: 0,
      partnerDebt: 0,
      partnerSaved: 0,
      partnerCredit: null,
      partnerEmployment: null,
      homeStyle: "condo",
      homeLayout: "onestory",
      beds: 2,
      baths: 2,
      parking: "garage",
      outdoorSpace: "balcony",
      lifestyle: { office: "nice", coffee: "nice" },
      neighborhood: { transit: "nice", nightlife: "nice" },
      timelineYears: 1,
      timelineBucket: "$3000",
      downGoalPct: 20,
      riskAnswers: { "0": 4, "1": 4, "2": 3, "3": 4 },
      assumptions: {},
    },
  },
  {
    email: "test4@keystone.test",
    displayName: "David & Amara Okafor",
    firstName: "David",
    lastName: "Okafor",
    blurb: "41 + 39 family of 4 in Phoenix — 5-yr stretch for a 4BR single-family (~$465k)",
    tier: "plus",
    answers: {
      age: 41,
      firstName: "David",
      lastName: "Okafor",
      email: "test4@keystone.test",
      phone: "6025550104",
      zip: "AZ",
      zipData: { avg: 465000, city: "Phoenix" },
      income: 68000,
      expenses: 3200,
      debt: 7000,
      saved: 14000,
      credit: 688,
      employment: "w2",
      hasPartner: true,
      partnerAge: 39,
      partnerFirstName: "Amara",
      partnerLastName: "Okafor",
      partnerEmail: "amara.test4@keystone.test",
      partnerIncome: 50000,
      partnerExpenses: 2200,
      partnerDebt: 4000,
      partnerSaved: 8000,
      partnerCredit: 695,
      partnerEmployment: "w2",
      homeStyle: "single",
      homeLayout: "twostory",
      beds: 4,
      baths: 2,
      parking: "garage",
      outdoorSpace: "yard",
      lifestyle: { garden: "nice", dog: "nice" },
      neighborhood: { schools: "nice", quiet: "nice", nature: "nice" },
      timelineYears: 5,
      timelineBucket: "$800",
      downGoalPct: 10,
      riskAnswers: { "0": 2, "1": 2, "2": 2, "3": 2 },
      assumptions: {},
    },
  },
  {
    email: "test5@keystone.test",
    displayName: "Jordan Bailey",
    firstName: "Jordan",
    lastName: "Bailey",
    blurb: "29, freelancer in Denver — 9 mo from a 2BR townhouse (~$525k)",
    tier: "pro",
    answers: {
      age: 29,
      firstName: "Jordan",
      lastName: "Bailey",
      email: "test5@keystone.test",
      phone: "3035550105",
      zip: "CO",
      zipData: { avg: 525000, city: "Denver" },
      income: 98000,
      expenses: 3200,
      debt: 3500,
      saved: 68000,
      credit: 760,
      employment: "self",
      hasPartner: false,
      partnerAge: 0,
      partnerFirstName: "",
      partnerLastName: "",
      partnerEmail: "",
      partnerIncome: 0,
      partnerExpenses: 0,
      partnerDebt: 0,
      partnerSaved: 0,
      partnerCredit: null,
      partnerEmployment: null,
      homeStyle: "townhouse",
      homeLayout: "twostory",
      beds: 2,
      baths: 2,
      parking: "garage",
      outdoorSpace: "patio",
      lifestyle: { office: "nice", coffee: "nice", dog: "nice" },
      neighborhood: { nature: "nice", nightlife: "nice", transit: "nice" },
      timelineYears: 1,
      timelineBucket: "$2000",
      downGoalPct: 20,
      riskAnswers: { "0": 3, "1": 3, "2": 3, "3": 3 },
      assumptions: {},
    },
  },
];

async function findUserByEmail(email: string): Promise<string | null> {
  // Paginate through users (typical projects have small N; bump perPage if needed).
  let page = 1;
  while (page < 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) return null;
    page++;
  }
  return null;
}

async function seed() {
  for (const p of personas) {
    console.log(`\n→ ${p.displayName} <${p.email}>`);

    // Wipe existing test user (cascades nothing — manually clear plans).
    const existingId = await findUserByEmail(p.email);
    if (existingId) {
      await admin.from("plans").delete().eq("user_id", existingId);
      await admin.from("subscriptions").delete().eq("user_id", existingId);
      await admin.auth.admin.deleteUser(existingId);
      console.log("  ✓ removed prior account");
    }

    // Create auth user (email-confirmed, no email sent).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: p.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: p.displayName },
    });
    if (createErr || !created.user) throw createErr ?? new Error("createUser failed");
    const userId = created.user.id;
    console.log(`  ✓ created auth user ${userId}`);

    // Trigger handle_new_user already inserted profile; update display_name to be safe.
    const { error: profErr } = await admin
      .from("profiles")
      .update({ display_name: p.displayName })
      .eq("user_id", userId);
    if (profErr) {
      // Fallback: insert if trigger somehow didn't fire.
      await admin
        .from("profiles")
        .insert({ user_id: userId, display_name: p.displayName });
    }
    console.log("  ✓ profile updated");

    // Insert the plan.
    const { error: planErr } = await admin.from("plans").insert({
      email: p.email,
      user_id: userId,
      first_name: p.firstName,
      last_name: p.lastName,
      phone: (p.answers.phone as string) ?? null,
      answers: p.answers,
      title: `${p.displayName} — ${(p.answers.zipData as { city: string }).city} plan`,
    });
    if (planErr) throw planErr;
    console.log("  ✓ plan seeded");
  }

  console.log("\n========================================");
  console.log(" Test accounts ready (password for all):");
  console.log(`   ${PASSWORD}`);
  console.log("========================================");
  for (const p of personas) {
    console.log(`  ${p.email}  —  ${p.displayName}`);
    console.log(`    ${p.blurb}`);
  }
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
