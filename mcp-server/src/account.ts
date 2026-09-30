import type { SupabaseClient } from "@supabase/supabase-js";

// Everything that belongs to one person. Child rows come first so a foreign
// key never blocks the delete.
const USER_TABLES = [
  "food_entry_ingredients",
  "saved_meal_ingredients",
  "food_entries",
  "saved_meals",
  "water_logs",
  "weight_logs",
  "goal_adjustments_log",
  "goals",
  "profile",
] as const;

// Connection records: tokens issued to AI apps, remembered approvals, and
// anything still mid sign-in.
const OAUTH_TABLES = ["oauth_tokens", "oauth_consents", "oauth_authorization_codes", "oauth_login_transactions"] as const;

export type AccountExport = {
  exported_at: string;
  user_id: string;
  profile: unknown;
  goals: unknown;
  goal_history: unknown[];
  food_entries: unknown[];
  saved_meals: unknown[];
  water_logs: unknown[];
  weight_logs: unknown[];
};

export async function exportAccountData(supabase: SupabaseClient, userId: string): Promise<AccountExport> {
  const mine = (table: string, select = "*") => supabase.from(table).select(select).eq("user_id", userId);

  const [profile, goals, goalHistory, entries, savedMeals, water, weight] = await Promise.all([
    mine("profile").maybeSingle(),
    mine("goals").maybeSingle(),
    mine("goal_adjustments_log"),
    mine("food_entries", "*, food_entry_ingredients(*)"),
    mine("saved_meals", "*, saved_meal_ingredients(*)"),
    mine("water_logs"),
    mine("weight_logs"),
  ]);

  for (const result of [profile, goals, goalHistory, entries, savedMeals, water, weight]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    exported_at: new Date().toISOString(),
    user_id: userId,
    profile: profile.data ?? null,
    goals: goals.data ?? null,
    goal_history: goalHistory.data ?? [],
    food_entries: entries.data ?? [],
    saved_meals: savedMeals.data ?? [],
    water_logs: water.data ?? [],
    weight_logs: weight.data ?? [],
  };
}

export async function deleteAccount(supabase: SupabaseClient, userId: string): Promise<void> {
  for (const table of [...USER_TABLES, ...OAUTH_TABLES]) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Couldn't clear ${table}: ${error.message}`);
  }

  // The sign-in itself can only go once the rows above are gone — Postgres
  // refuses while anything still references auth.users.
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Couldn't delete the sign-in account: ${error.message}`);
}
