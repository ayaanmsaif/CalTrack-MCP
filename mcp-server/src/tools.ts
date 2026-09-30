import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DateTime, IANAZone } from "luxon";
import { deleteAccount, exportAccountData } from "./account.js";

export type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;
export type ResolveUserId = (extra: ToolExtra) => string;

const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string().optional(),
  calories: z.number(),
  protein_g: z.number(),
  carb_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number().default(0),
  sugar_g: z.number().default(0),
});

async function getUserTimezone(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: profile } = await supabase.from("profile").select("timezone").eq("user_id", userId).maybeSingle();

  return profile?.timezone ?? "UTC";
}

function fetchFoodEntriesInRange(supabase: SupabaseClient, userId: string, startUtcIso: string, endUtcIso: string) {
  return supabase
    .from("food_entries")
    .select(
      "id, description, meal_type, logged_at, calories, protein_g, carb_g, fat_g, food_entry_ingredients(name, quantity, unit, calories, protein_g, carb_g, fat_g)"
    )
    .eq("user_id", userId)
    .gte("logged_at", startUtcIso)
    .lte("logged_at", endUtcIso)
    .order("logged_at", { ascending: true });
}

function formatMealsSummary(
  entries: { id: string; meal_type: string; description: string; logged_at: string; calories: number; protein_g: number; carb_g: number; fat_g: number }[] | null,
  timezone: string,
  rangeLabel: string
): string {
  if (!entries || entries.length === 0) {
    return `No meals logged ${rangeLabel} (timezone: ${timezone}).`;
  }

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein_g: acc.protein_g + e.protein_g,
      carb_g: acc.carb_g + e.carb_g,
      fat_g: acc.fat_g + e.fat_g,
    }),
    { calories: 0, protein_g: 0, carb_g: 0, fat_g: 0 }
  );

  const lines = entries.map((e) => {
    const local = DateTime.fromISO(e.logged_at).setZone(timezone).toFormat("yyyy-LL-dd HH:mm");
    return `${e.id} [${local}] ${e.meal_type}: ${e.description} — ${e.calories} kcal, ${e.protein_g}g protein, ${e.carb_g}g carbs, ${e.fat_g}g fat`;
  });

  return `Totals ${rangeLabel} (${timezone}): ${round1(totals.calories)} kcal, ${round1(totals.protein_g)}g protein, ${round1(totals.carb_g)}g carbs, ${round1(totals.fat_g)}g fat\n\n${lines.join("\n")}`;
}

// --- Calorie/macro calculation (spec §5) -----------------------------------

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const KCAL_PER_KG = 7700;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function calculateTargets(params: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "male" | "female";
  activityLevel: keyof typeof ACTIVITY_MULTIPLIERS;
  goalType: "lose_weight" | "maintain" | "gain_weight" | "gain_muscle";
  weeklyRateKg: number;
}) {
  const bmr =
    params.sex === "male"
      ? 10 * params.weightKg + 6.25 * params.heightCm - 5 * params.age + 5
      : 10 * params.weightKg + 6.25 * params.heightCm - 5 * params.age - 161;

  const tdee = bmr * ACTIVITY_MULTIPLIERS[params.activityLevel];

  // Safety floor: weekly rate never exceeds ~1% of current bodyweight/week.
  const maxWeeklyRateKg = params.weightKg * 0.01;
  const rateCapped = Math.abs(params.weeklyRateKg) > maxWeeklyRateKg;
  const weeklyRateKg = rateCapped ? Math.sign(params.weeklyRateKg) * maxWeeklyRateKg : params.weeklyRateKg;

  const uncappedDailyCalories = tdee + (weeklyRateKg * KCAL_PER_KG) / 7;
  // Safety floor: daily target never drops below ~1.2x BMR.
  const calorieFloor = bmr * 1.2;
  const floorApplied = uncappedDailyCalories < calorieFloor;
  const dailyCalories = Math.round(floorApplied ? calorieFloor : uncappedDailyCalories);

  const proteinPerKg = params.goalType === "lose_weight" || params.goalType === "gain_muscle" ? 2.0 : 1.5;
  const proteinG = round1(proteinPerKg * params.weightKg);
  const fatG = round1(Math.max((0.25 * dailyCalories) / 9, 0.5 * params.weightKg));
  const carbG = round1(Math.max(0, (dailyCalories - proteinG * 4 - fatG * 9) / 4));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyCalories,
    proteinG,
    carbG,
    fatG,
    weeklyRateKg: round1(weeklyRateKg),
    rateCapped,
    maxWeeklyRateKg: round1(maxWeeklyRateKg),
    floorApplied,
  };
}

// Recomputes and saves daily_calories/protein_g/carb_g/fat_g from the
// current profile, latest logged weight, and goals — used by set_profile,
// set_goals, and recalculate_targets alike, since any of those changing is
// spec'd to retrigger the calculation. Locked fields (calories_locked /
// macros_locked, set via the override tools) are left untouched.
async function recalculateAndSaveGoals(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true; summary: string } | { ok: false; reason: string }> {
  const { data: profile } = await supabase.from("profile").select("*").eq("user_id", userId).maybeSingle();
  if (!profile || profile.height_cm == null || profile.age == null || !profile.sex || !profile.activity_level) {
    return { ok: false, reason: "Profile is incomplete — call set_profile first." };
  }

  const { data: goals } = await supabase.from("goals").select("*").eq("user_id", userId).maybeSingle();
  if (!goals) {
    return { ok: false, reason: "Goals not set yet — call set_goals first." };
  }

  const { data: latestWeight } = await supabase
    .from("weight_logs")
    .select("weight_kg")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestWeight) {
    return { ok: false, reason: "No weight logged yet — log your current weight first." };
  }

  const targets = calculateTargets({
    weightKg: latestWeight.weight_kg,
    heightCm: profile.height_cm,
    age: profile.age,
    sex: profile.sex,
    activityLevel: profile.activity_level,
    goalType: goals.goal_type,
    weeklyRateKg: goals.weekly_rate_kg,
  });

  const updates: Record<string, string | number> = { last_recalculated_at: new Date().toISOString() };
  if (!goals.calories_locked) updates.daily_calories = targets.dailyCalories;
  if (!goals.macros_locked) {
    updates.protein_g = targets.proteinG;
    updates.carb_g = targets.carbG;
    updates.fat_g = targets.fatG;
  }

  const { error } = await supabase.from("goals").update(updates).eq("user_id", userId);
  if (error) {
    return { ok: false, reason: `Error saving targets: ${error.message}` };
  }

  const finalCalories = goals.calories_locked ? goals.daily_calories : targets.dailyCalories;
  const finalProtein = goals.macros_locked ? goals.protein_g : targets.proteinG;
  const finalCarb = goals.macros_locked ? goals.carb_g : targets.carbG;
  const finalFat = goals.macros_locked ? goals.fat_g : targets.fatG;

  const notes = [
    targets.rateCapped && `weekly rate capped to ±${targets.maxWeeklyRateKg}kg/week for safety`,
    targets.floorApplied && "calorie floor applied (never below 1.2x BMR)",
    goals.calories_locked && "calories locked — unaffected",
    goals.macros_locked && "macros locked — unaffected",
  ]
    .filter(Boolean)
    .join("; ");

  return {
    ok: true,
    summary: `BMR ${targets.bmr}, TDEE ${targets.tdee} → daily target ${finalCalories} kcal, ${finalProtein}g protein, ${finalCarb}g carbs, ${finalFat}g fat.${notes ? ` (${notes})` : ""}`,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerTools(server: McpServer, supabase: SupabaseClient, resolveUserId: ResolveUserId): void {
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "A test tool that echoes back a message, to confirm the server is wired up correctly.",
      inputSchema: { message: z.string() },
    },
    async ({ message }) => ({
      content: [{ type: "text", text: `pong: ${message}` }],
    })
  );

  server.registerTool(
    "log_food_entry",
    {
      title: "Log Food Entry",
      description:
        "Logs a meal, snack, or single food item, broken down into its individual ingredients with their macros. If a portion size isn't clear from what the user said, ask them before logging rather than guessing.",
      inputSchema: {
        description: z.string().describe("Short description of what was eaten, e.g. 'Beef mince with potatoes'"),
        meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        ingredients: z.array(ingredientSchema),
        logged_at: z.string().optional().describe("ISO timestamp; defaults to now"),
      },
    },
    async ({ description, meal_type, ingredients, logged_at }, extra) => {
      const userId = resolveUserId(extra);

      const { data: entry, error: entryError } = await supabase
        .from("food_entries")
        .insert({
          user_id: userId,
          description,
          meal_type,
          logged_at: logged_at ?? new Date().toISOString(),
          source: "text_estimated",
        })
        .select()
        .single();

      if (entryError) {
        return { content: [{ type: "text", text: `Error creating entry: ${entryError.message}` }], isError: true };
      }

      const rows = ingredients.map((ing) => ({ entry_id: entry.id, ...ing }));
      const { error: ingError } = await supabase.from("food_entry_ingredients").insert(rows);

      if (ingError) {
        return { content: [{ type: "text", text: `Error adding ingredients: ${ingError.message}` }], isError: true };
      }

      const { data: finalEntry } = await supabase
        .from("food_entries")
        .select("calories, protein_g, carb_g, fat_g")
        .eq("id", entry.id)
        .single();

      return {
        content: [
          {
            type: "text",
            text: `Logged "${description}" (${meal_type}): ${finalEntry?.calories} kcal, ${finalEntry?.protein_g}g protein, ${finalEntry?.carb_g}g carbs, ${finalEntry?.fat_g}g fat.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_meals_today",
    {
      title: "Get Meals Today",
      description: "Lists everything logged today (in the user's profile timezone, defaulting to UTC) with per-entry macros and a daily total.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const userId = resolveUserId(extra);
      const timezone = await getUserTimezone(supabase, userId);
      const today = DateTime.now().setZone(timezone);

      const { data: entries, error } = await fetchFoodEntriesInRange(
        supabase,
        userId,
        today.startOf("day").toUTC().toISO()!,
        today.endOf("day").toUTC().toISO()!
      );

      if (error) {
        return { content: [{ type: "text", text: `Error fetching meals: ${error.message}` }], isError: true };
      }

      return { content: [{ type: "text", text: formatMealsSummary(entries, timezone, "today") }] };
    }
  );

  server.registerTool(
    "get_meals_by_date",
    {
      title: "Get Meals By Date",
      description: "Lists everything logged on a specific calendar date, interpreted in the user's profile timezone.",
      inputSchema: {
        date: z.string().describe("Date in YYYY-MM-DD format, interpreted in the user's profile timezone"),
      },
    },
    async ({ date }, extra) => {
      const userId = resolveUserId(extra);
      const timezone = await getUserTimezone(supabase, userId);
      const day = DateTime.fromISO(date, { zone: timezone });

      if (!day.isValid) {
        return { content: [{ type: "text", text: `Invalid date "${date}": ${day.invalidReason}` }], isError: true };
      }

      const { data: entries, error } = await fetchFoodEntriesInRange(
        supabase,
        userId,
        day.startOf("day").toUTC().toISO()!,
        day.endOf("day").toUTC().toISO()!
      );

      if (error) {
        return { content: [{ type: "text", text: `Error fetching meals: ${error.message}` }], isError: true };
      }

      return { content: [{ type: "text", text: formatMealsSummary(entries, timezone, `on ${date}`) }] };
    }
  );

  server.registerTool(
    "get_meals_by_date_range",
    {
      title: "Get Meals By Date Range",
      description: "Lists everything logged within an inclusive date range, interpreted in the user's profile timezone.",
      inputSchema: {
        start_date: z.string().describe("Start date, inclusive, YYYY-MM-DD, in the user's profile timezone"),
        end_date: z.string().describe("End date, inclusive, YYYY-MM-DD, in the user's profile timezone"),
      },
    },
    async ({ start_date, end_date }, extra) => {
      const userId = resolveUserId(extra);
      const timezone = await getUserTimezone(supabase, userId);
      const start = DateTime.fromISO(start_date, { zone: timezone });
      const end = DateTime.fromISO(end_date, { zone: timezone });

      if (!start.isValid) {
        return { content: [{ type: "text", text: `Invalid start_date "${start_date}": ${start.invalidReason}` }], isError: true };
      }
      if (!end.isValid) {
        return { content: [{ type: "text", text: `Invalid end_date "${end_date}": ${end.invalidReason}` }], isError: true };
      }
      if (end < start) {
        return { content: [{ type: "text", text: `end_date (${end_date}) is before start_date (${start_date}).` }], isError: true };
      }

      const { data: entries, error } = await fetchFoodEntriesInRange(
        supabase,
        userId,
        start.startOf("day").toUTC().toISO()!,
        end.endOf("day").toUTC().toISO()!
      );

      if (error) {
        return { content: [{ type: "text", text: `Error fetching meals: ${error.message}` }], isError: true };
      }

      return { content: [{ type: "text", text: formatMealsSummary(entries, timezone, `from ${start_date} to ${end_date}`) }] };
    }
  );

  server.registerTool(
    "search_meals",
    {
      title: "Search Meals",
      description: "Searches past one-off logged entries by description text — for finding what was logged before, not saved-meal templates.",
      inputSchema: {
        queries: z
          .array(z.string())
          .min(1)
          .describe("Search terms to match against past entry descriptions, e.g. ['chicken', 'rice']. An entry matches if it contains any of these terms."),
        days: z.number().optional().describe("Only search entries logged within the last N days; omit to search all history"),
        limit: z.number().optional().describe("Max number of results to return (default 20)"),
      },
    },
    async ({ queries, days, limit }, extra) => {
      const userId = resolveUserId(extra);
      const timezone = await getUserTimezone(supabase, userId);

      let query = supabase
        .from("food_entries")
        .select("id, description, meal_type, logged_at, calories, protein_g, carb_g, fat_g")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(limit ?? 20);

      const orFilter = queries.map((term) => `description.ilike.%${term.replace(/[(),%]/g, " ").trim()}%`).join(",");
      query = query.or(orFilter);

      if (days) {
        query = query.gte("logged_at", DateTime.now().minus({ days }).toUTC().toISO()!);
      }

      const { data: entries, error } = await query;

      if (error) {
        return { content: [{ type: "text", text: `Error searching meals: ${error.message}` }], isError: true };
      }

      if (!entries || entries.length === 0) {
        return { content: [{ type: "text", text: `No past entries matched ${queries.join(", ")}.` }] };
      }

      const lines = entries.map((e) => {
        const local = DateTime.fromISO(e.logged_at).setZone(timezone).toFormat("yyyy-LL-dd HH:mm");
        return `${e.id} [${local}] ${e.meal_type}: ${e.description} — ${e.calories} kcal, ${e.protein_g}g protein, ${e.carb_g}g carbs, ${e.fat_g}g fat`;
      });

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "update_food_entry",
    {
      title: "Update Food Entry",
      description: "Updates an existing food entry's meal type, logged time, and/or ingredient list. Replacing the ingredient list recomputes the entry's totals automatically.",
      inputSchema: {
        id: z.string().describe("The food_entries row id to update"),
        ingredients: z.array(ingredientSchema).optional().describe("If provided, replaces the entry's entire ingredient list"),
        meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
        logged_at: z.string().optional().describe("ISO timestamp"),
      },
    },
    async ({ id, ingredients, meal_type, logged_at }, extra) => {
      const userId = resolveUserId(extra);

      const { data: existing, error: findError } = await supabase
        .from("food_entries")
        .select("id")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (findError) {
        return { content: [{ type: "text", text: `Error looking up entry: ${findError.message}` }], isError: true };
      }
      if (!existing) {
        return { content: [{ type: "text", text: `No food entry found with id ${id}.` }], isError: true };
      }

      const updates: Record<string, string> = {};
      if (meal_type) updates.meal_type = meal_type;
      if (logged_at) updates.logged_at = logged_at;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from("food_entries").update(updates).eq("id", id).eq("user_id", userId);
        if (updateError) {
          return { content: [{ type: "text", text: `Error updating entry: ${updateError.message}` }], isError: true };
        }
      }

      if (ingredients) {
        const { error: deleteError } = await supabase.from("food_entry_ingredients").delete().eq("entry_id", id).eq("user_id", userId);
        if (deleteError) {
          return { content: [{ type: "text", text: `Error clearing old ingredients: ${deleteError.message}` }], isError: true };
        }

        const rows = ingredients.map((ing) => ({ entry_id: id, ...ing }));
        const { error: insertError } = await supabase.from("food_entry_ingredients").insert(rows);
        if (insertError) {
          return { content: [{ type: "text", text: `Error adding new ingredients: ${insertError.message}` }], isError: true };
        }
      }

      const { data: finalEntry } = await supabase
        .from("food_entries")
        .select("description, meal_type, calories, protein_g, carb_g, fat_g")
        .eq("id", id)
        .single();

      return {
        content: [
          {
            type: "text",
            text: `Updated "${finalEntry?.description}" (${finalEntry?.meal_type}): ${finalEntry?.calories} kcal, ${finalEntry?.protein_g}g protein, ${finalEntry?.carb_g}g carbs, ${finalEntry?.fat_g}g fat.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_food_entry",
    {
      title: "Delete Food Entry",
      description: "Deletes a logged food entry and its ingredients.",
      inputSchema: {
        id: z.string().describe("The food_entries row id to delete"),
      },
    },
    async ({ id }, extra) => {
      const userId = resolveUserId(extra);

      const { data, error } = await supabase
        .from("food_entries")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .select("id, description")
        .maybeSingle();

      if (error) {
        return { content: [{ type: "text", text: `Error deleting entry: ${error.message}` }], isError: true };
      }
      if (!data) {
        return { content: [{ type: "text", text: `No food entry found with id ${id}.` }], isError: true };
      }

      return { content: [{ type: "text", text: `Deleted "${data.description}".` }] };
    }
  );

  server.registerTool(
    "create_saved_meal",
    {
      title: "Create Saved Meal",
      description: "Saves a reusable meal template. Provide either an ingredient list directly, or from_entry_id to copy ingredients from an already-logged food entry.",
      inputSchema: {
        name: z.string().describe("Name to save the meal under, e.g. 'Signature milkshake'"),
        description: z.string().optional(),
        ingredients: z.array(ingredientSchema).optional(),
        from_entry_id: z.string().optional().describe("A food_entries id to copy ingredients from, instead of specifying ingredients directly"),
      },
    },
    async ({ name, description, ingredients, from_entry_id }, extra) => {
      const userId = resolveUserId(extra);

      if (!ingredients && !from_entry_id) {
        return { content: [{ type: "text", text: "Provide either ingredients or from_entry_id." }], isError: true };
      }
      if (ingredients && from_entry_id) {
        return { content: [{ type: "text", text: "Provide only one of ingredients or from_entry_id, not both." }], isError: true };
      }

      let sourceIngredients = ingredients;

      if (from_entry_id) {
        const { data: copied, error: copyError } = await supabase
          .from("food_entry_ingredients")
          .select("name, quantity, unit, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g")
          .eq("entry_id", from_entry_id)
          .eq("user_id", userId);

        if (copyError) {
          return { content: [{ type: "text", text: `Error copying ingredients: ${copyError.message}` }], isError: true };
        }
        if (!copied || copied.length === 0) {
          return { content: [{ type: "text", text: `No food entry found with id ${from_entry_id}.` }], isError: true };
        }
        sourceIngredients = copied;
      }

      const { data: savedMeal, error: mealError } = await supabase
        .from("saved_meals")
        .insert({ user_id: userId, name, description: description ?? null, created_from: "manual" })
        .select()
        .single();

      if (mealError) {
        if (mealError.code === "23505") {
          return { content: [{ type: "text", text: `A saved meal named "${name}" already exists.` }], isError: true };
        }
        return { content: [{ type: "text", text: `Error creating saved meal: ${mealError.message}` }], isError: true };
      }

      const rows = sourceIngredients!.map((ing) => ({ saved_meal_id: savedMeal.id, ...ing }));
      const { error: ingError } = await supabase.from("saved_meal_ingredients").insert(rows);

      if (ingError) {
        return { content: [{ type: "text", text: `Error adding ingredients: ${ingError.message}` }], isError: true };
      }

      const { data: finalMeal } = await supabase
        .from("saved_meals")
        .select("calories, protein_g, carb_g, fat_g")
        .eq("id", savedMeal.id)
        .single();

      return {
        content: [
          {
            type: "text",
            text: `Saved "${name}": ${finalMeal?.calories} kcal, ${finalMeal?.protein_g}g protein, ${finalMeal?.carb_g}g carbs, ${finalMeal?.fat_g}g fat.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "log_saved_meal",
    {
      title: "Log Saved Meal",
      description: "Recalls a saved meal template and logs it as a new food entry, scaled by an optional quantity multiplier. No re-estimation — copies the template's stored macros exactly.",
      inputSchema: {
        name_or_id: z.string().describe("The saved meal's id, or its exact name"),
        meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        quantity: z.number().positive().optional().describe("Scale multiplier, e.g. 2 for two servings; defaults to 1"),
        logged_at: z.string().optional().describe("ISO timestamp; defaults to now"),
      },
    },
    async ({ name_or_id, meal_type, quantity, logged_at }, extra) => {
      const userId = resolveUserId(extra);

      const lookup = supabase.from("saved_meals").select("id, name, description").eq("user_id", userId);
      const { data: savedMeal, error: findError } = await (UUID_RE.test(name_or_id)
        ? lookup.eq("id", name_or_id)
        : lookup.ilike("name", name_or_id)
      ).maybeSingle();

      if (findError) {
        return { content: [{ type: "text", text: `Error looking up saved meal: ${findError.message}` }], isError: true };
      }
      if (!savedMeal) {
        return { content: [{ type: "text", text: `No saved meal matching "${name_or_id}". Try search_saved_meals first.` }], isError: true };
      }

      const { data: templateIngredients, error: ingError } = await supabase
        .from("saved_meal_ingredients")
        .select("name, quantity, unit, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g")
        .eq("saved_meal_id", savedMeal.id);

      if (ingError) {
        return { content: [{ type: "text", text: `Error loading saved meal ingredients: ${ingError.message}` }], isError: true };
      }

      const multiplier = quantity ?? 1;

      const { data: entry, error: entryError } = await supabase
        .from("food_entries")
        .insert({
          user_id: userId,
          description: savedMeal.description ?? savedMeal.name,
          meal_type,
          logged_at: logged_at ?? new Date().toISOString(),
          source: "saved_meal",
          saved_meal_id: savedMeal.id,
        })
        .select()
        .single();

      if (entryError) {
        return { content: [{ type: "text", text: `Error creating entry: ${entryError.message}` }], isError: true };
      }

      const rows = (templateIngredients ?? []).map((ing) => ({
        entry_id: entry.id,
        name: ing.name,
        quantity: ing.quantity * multiplier,
        unit: ing.unit,
        calories: ing.calories * multiplier,
        protein_g: ing.protein_g * multiplier,
        carb_g: ing.carb_g * multiplier,
        fat_g: ing.fat_g * multiplier,
        fiber_g: ing.fiber_g * multiplier,
        sugar_g: ing.sugar_g * multiplier,
      }));

      const { error: rowsError } = await supabase.from("food_entry_ingredients").insert(rows);

      if (rowsError) {
        return { content: [{ type: "text", text: `Error adding ingredients: ${rowsError.message}` }], isError: true };
      }

      const { data: finalEntry } = await supabase
        .from("food_entries")
        .select("calories, protein_g, carb_g, fat_g")
        .eq("id", entry.id)
        .single();

      return {
        content: [
          {
            type: "text",
            text: `Logged "${savedMeal.name}" x${multiplier} (${meal_type}): ${finalEntry?.calories} kcal, ${finalEntry?.protein_g}g protein, ${finalEntry?.carb_g}g carbs, ${finalEntry?.fat_g}g fat.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "update_saved_meal",
    {
      title: "Update Saved Meal",
      description: "Updates a saved meal's name, description, and/or ingredient list. Replacing the ingredient list recomputes its totals automatically.",
      inputSchema: {
        id: z.string().describe("The saved_meals row id to update"),
        name: z.string().optional(),
        description: z.string().optional(),
        ingredients: z.array(ingredientSchema).optional().describe("If provided, replaces the meal's entire ingredient list"),
      },
    },
    async ({ id, name, description, ingredients }, extra) => {
      const userId = resolveUserId(extra);

      const { data: existing, error: findError } = await supabase
        .from("saved_meals")
        .select("id")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (findError) {
        return { content: [{ type: "text", text: `Error looking up saved meal: ${findError.message}` }], isError: true };
      }
      if (!existing) {
        return { content: [{ type: "text", text: `No saved meal found with id ${id}.` }], isError: true };
      }

      const updates: Record<string, string> = {};
      if (name) updates.name = name;
      if (description) updates.description = description;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from("saved_meals").update(updates).eq("id", id).eq("user_id", userId);
        if (updateError) {
          if (updateError.code === "23505") {
            return { content: [{ type: "text", text: `A saved meal named "${name}" already exists.` }], isError: true };
          }
          return { content: [{ type: "text", text: `Error updating saved meal: ${updateError.message}` }], isError: true };
        }
      }

      if (ingredients) {
        const { error: deleteError } = await supabase.from("saved_meal_ingredients").delete().eq("saved_meal_id", id).eq("user_id", userId);
        if (deleteError) {
          return { content: [{ type: "text", text: `Error clearing old ingredients: ${deleteError.message}` }], isError: true };
        }

        const rows = ingredients.map((ing) => ({ saved_meal_id: id, ...ing }));
        const { error: insertError } = await supabase.from("saved_meal_ingredients").insert(rows);
        if (insertError) {
          return { content: [{ type: "text", text: `Error adding new ingredients: ${insertError.message}` }], isError: true };
        }
      }

      const { data: finalMeal } = await supabase
        .from("saved_meals")
        .select("name, calories, protein_g, carb_g, fat_g")
        .eq("id", id)
        .single();

      return {
        content: [
          {
            type: "text",
            text: `Updated "${finalMeal?.name}": ${finalMeal?.calories} kcal, ${finalMeal?.protein_g}g protein, ${finalMeal?.carb_g}g carbs, ${finalMeal?.fat_g}g fat.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_saved_meal",
    {
      title: "Delete Saved Meal",
      description: "Deletes a saved meal template and its ingredients. Does not affect food entries already logged from it.",
      inputSchema: {
        id: z.string().describe("The saved_meals row id to delete"),
      },
    },
    async ({ id }, extra) => {
      const userId = resolveUserId(extra);

      const { data, error } = await supabase
        .from("saved_meals")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .select("id, name")
        .maybeSingle();

      if (error) {
        return { content: [{ type: "text", text: `Error deleting saved meal: ${error.message}` }], isError: true };
      }
      if (!data) {
        return { content: [{ type: "text", text: `No saved meal found with id ${id}.` }], isError: true };
      }

      return { content: [{ type: "text", text: `Deleted "${data.name}".` }] };
    }
  );

  server.registerTool(
    "search_saved_meals",
    {
      title: "Search Saved Meals",
      description: "Fuzzy-searches saved meal templates by name — use this to resolve a name mentioned in chat to an id before calling log_saved_meal.",
      inputSchema: {
        query: z.string().describe("Text to match against saved meal names, e.g. 'milkshake'"),
      },
    },
    async ({ query }, extra) => {
      const userId = resolveUserId(extra);

      const { data: meals, error } = await supabase
        .from("saved_meals")
        .select("id, name, description, calories, protein_g, carb_g, fat_g")
        .eq("user_id", userId)
        .ilike("name", `%${query}%`)
        .order("name");

      if (error) {
        return { content: [{ type: "text", text: `Error searching saved meals: ${error.message}` }], isError: true };
      }
      if (!meals || meals.length === 0) {
        return { content: [{ type: "text", text: `No saved meals matched "${query}".` }] };
      }

      const lines = meals.map(
        (m) => `${m.id} — ${m.name}: ${m.calories} kcal, ${m.protein_g}g protein, ${m.carb_g}g carbs, ${m.fat_g}g fat`
      );

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "list_saved_meals",
    {
      title: "List Saved Meals",
      description: "Lists all of the user's saved meal templates.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const userId = resolveUserId(extra);

      const { data: meals, error } = await supabase
        .from("saved_meals")
        .select("id, name, description, calories, protein_g, carb_g, fat_g")
        .eq("user_id", userId)
        .order("name");

      if (error) {
        return { content: [{ type: "text", text: `Error listing saved meals: ${error.message}` }], isError: true };
      }
      if (!meals || meals.length === 0) {
        return { content: [{ type: "text", text: "No saved meals yet." }] };
      }

      const lines = meals.map(
        (m) => `${m.id} — ${m.name}: ${m.calories} kcal, ${m.protein_g}g protein, ${m.carb_g}g carbs, ${m.fat_g}g fat`
      );

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "set_profile",
    {
      title: "Set Profile",
      description:
        "Sets or updates the user's body stats and preferences used for calorie/macro calculations. Recalculates daily targets automatically if goals are already set.",
      inputSchema: {
        height: z.number().positive().describe("Height, in the given height_unit"),
        height_unit: z.enum(["cm", "in"]),
        age: z.number().int().positive(),
        sex: z.enum(["male", "female"]),
        activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
        weight_unit: z.enum(["kg", "lb"]),
        timezone: z.string().describe("IANA timezone name, e.g. 'Europe/London'"),
      },
    },
    async ({ height, height_unit, age, sex, activity_level, weight_unit, timezone }, extra) => {
      const userId = resolveUserId(extra);

      if (!IANAZone.isValidZone(timezone)) {
        return { content: [{ type: "text", text: `Invalid timezone "${timezone}".` }], isError: true };
      }

      const height_cm = height_unit === "cm" ? height : height * CM_PER_IN;

      const { error } = await supabase
        .from("profile")
        .upsert({ user_id: userId, height_cm, age, sex, activity_level, weight_unit, height_unit, timezone }, { onConflict: "user_id" });

      if (error) {
        return { content: [{ type: "text", text: `Error saving profile: ${error.message}` }], isError: true };
      }

      const recalc = await recalculateAndSaveGoals(supabase, userId);
      const recalcNote = recalc.ok ? `Targets recalculated: ${recalc.summary}` : recalc.reason;

      return {
        content: [
          {
            type: "text",
            text: `Profile saved: ${age}yo ${sex}, ${height_cm.toFixed(1)}cm, ${activity_level} activity, timezone ${timezone}.\n${recalcNote}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "set_goals",
    {
      title: "Set Goals",
      description: "Sets the user's goal type, target weight, and desired weekly rate of change, then computes a daily calorie and macro target.",
      inputSchema: {
        goal_type: z.enum(["lose_weight", "maintain", "gain_weight", "gain_muscle"]),
        goal_weight: z.number().positive().optional().describe("Target weight, in the profile's weight_unit"),
        weekly_rate: z
          .number()
          .min(0)
          .optional()
          .describe(
            "Desired weekly rate of change, as a magnitude in the profile's weight_unit per week (sign is derived from goal_type). Ignored for 'maintain'."
          ),
      },
    },
    async ({ goal_type, goal_weight, weekly_rate }, extra) => {
      const userId = resolveUserId(extra);

      const { data: profile } = await supabase.from("profile").select("weight_unit").eq("user_id", userId).maybeSingle();
      if (!profile) {
        return { content: [{ type: "text", text: "Set your profile first (call set_profile)." }], isError: true };
      }

      const toKg = (value: number) => (profile.weight_unit === "lb" ? value * KG_PER_LB : value);

      const rateMagnitudeKg = weekly_rate != null ? toKg(weekly_rate) : 0;
      const weekly_rate_kg =
        goal_type === "maintain" ? 0 : goal_type === "lose_weight" ? -Math.abs(rateMagnitudeKg) : Math.abs(rateMagnitudeKg);

      // goal_weight is optional — only touch goal_weight_kg when a value was actually given,
      // so a later set_goals call that just changes goal_type doesn't wipe a previously-set target.
      const { error } = await supabase.from("goals").upsert(
        goal_weight != null
          ? { user_id: userId, goal_type, weekly_rate_kg, goal_weight_kg: toKg(goal_weight) }
          : { user_id: userId, goal_type, weekly_rate_kg },
        { onConflict: "user_id" }
      );

      if (error) {
        return { content: [{ type: "text", text: `Error saving goals: ${error.message}` }], isError: true };
      }

      const recalc = await recalculateAndSaveGoals(supabase, userId);
      const recalcNote = recalc.ok ? recalc.summary : recalc.reason;

      return { content: [{ type: "text", text: `Goals saved (${goal_type}). ${recalcNote}` }] };
    }
  );

  server.registerTool(
    "get_goals",
    {
      title: "Get Goals",
      description: "Returns the user's current goal settings and computed daily calorie/macro targets.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const userId = resolveUserId(extra);

      const { data: goals, error } = await supabase.from("goals").select("*").eq("user_id", userId).maybeSingle();

      if (error) {
        return { content: [{ type: "text", text: `Error fetching goals: ${error.message}` }], isError: true };
      }
      if (!goals) {
        return { content: [{ type: "text", text: "No goals set yet — call set_goals first." }] };
      }

      return {
        content: [
          {
            type: "text",
            text: `Goal: ${goals.goal_type}${goals.goal_weight_kg ? `, target ${goals.goal_weight_kg}kg` : ""}, rate ${goals.weekly_rate_kg}kg/week.\nDaily target: ${goals.daily_calories} kcal, ${goals.protein_g}g protein, ${goals.carb_g}g carbs, ${goals.fat_g}g fat.${goals.calories_locked ? " [calories locked]" : ""}${goals.macros_locked ? " [macros locked]" : ""}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_goal_progress",
    {
      title: "Get Goal Progress",
      description: "Compares a day's logged intake against the daily calorie/macro targets. Defaults to today.",
      inputSchema: {
        date: z.string().optional().describe("YYYY-MM-DD, interpreted in the profile timezone; defaults to today"),
      },
    },
    async ({ date }, extra) => {
      const userId = resolveUserId(extra);

      const { data: goals, error: goalsError } = await supabase.from("goals").select("*").eq("user_id", userId).maybeSingle();
      if (goalsError) {
        return { content: [{ type: "text", text: `Error fetching goals: ${goalsError.message}` }], isError: true };
      }
      if (!goals) {
        return { content: [{ type: "text", text: "No goals set yet — call set_goals first." }], isError: true };
      }

      const timezone = await getUserTimezone(supabase, userId);
      const day = date ? DateTime.fromISO(date, { zone: timezone }) : DateTime.now().setZone(timezone);
      if (!day.isValid) {
        return { content: [{ type: "text", text: `Invalid date "${date}": ${day.invalidReason}` }], isError: true };
      }

      const { data: entries, error: entriesError } = await fetchFoodEntriesInRange(
        supabase,
        userId,
        day.startOf("day").toUTC().toISO()!,
        day.endOf("day").toUTC().toISO()!
      );
      if (entriesError) {
        return { content: [{ type: "text", text: `Error fetching meals: ${entriesError.message}` }], isError: true };
      }

      const actual = (entries ?? []).reduce(
        (acc, e) => ({
          calories: acc.calories + e.calories,
          protein_g: acc.protein_g + e.protein_g,
          carb_g: acc.carb_g + e.carb_g,
          fat_g: acc.fat_g + e.fat_g,
        }),
        { calories: 0, protein_g: 0, carb_g: 0, fat_g: 0 }
      );

      const label = date ?? "today";

      return {
        content: [
          {
            type: "text",
            text: `Progress for ${label} (${timezone}):\nCalories: ${round1(actual.calories)} / ${goals.daily_calories} kcal (${round1(goals.daily_calories - actual.calories)} remaining)\nProtein: ${round1(actual.protein_g)} / ${goals.protein_g} g\nCarbs: ${round1(actual.carb_g)} / ${goals.carb_g} g\nFat: ${round1(actual.fat_g)} / ${goals.fat_g} g`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_goal_history",
    {
      title: "Get Goal History",
      description: "Lists the audit log of automatic target adjustments made by the adaptive weekly recalibration job.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const userId = resolveUserId(extra);

      const { data: log, error } = await supabase
        .from("goal_adjustments_log")
        .select("adjusted_at, old_calories, new_calories, old_protein_g, new_protein_g, old_carb_g, new_carb_g, old_fat_g, new_fat_g")
        .eq("user_id", userId)
        .order("adjusted_at", { ascending: false });

      if (error) {
        return { content: [{ type: "text", text: `Error fetching goal history: ${error.message}` }], isError: true };
      }
      if (!log || log.length === 0) {
        return { content: [{ type: "text", text: "No adjustments recorded yet." }] };
      }

      const lines = log.map(
        (l) =>
          `${l.adjusted_at}: ${l.old_calories} → ${l.new_calories} kcal, protein ${l.old_protein_g} → ${l.new_protein_g}g, carbs ${l.old_carb_g} → ${l.new_carb_g}g, fat ${l.old_fat_g} → ${l.new_fat_g}g`
      );

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "set_calorie_override",
    {
      title: "Set Calorie Override",
      description: "Manually locks the daily calorie target to a specific value, excluding it from recalculation until unlocked (from the dashboard).",
      inputSchema: {
        value: z.number().positive(),
      },
    },
    async ({ value }, extra) => {
      const userId = resolveUserId(extra);

      const { data: goals } = await supabase.from("goals").select("user_id").eq("user_id", userId).maybeSingle();
      if (!goals) {
        return { content: [{ type: "text", text: "No goals set yet — call set_goals first." }], isError: true };
      }

      const { error } = await supabase.from("goals").update({ daily_calories: value, calories_locked: true }).eq("user_id", userId);

      if (error) {
        return { content: [{ type: "text", text: `Error setting override: ${error.message}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Daily calorie target locked at ${value} kcal.` }] };
    }
  );

  server.registerTool(
    "set_macro_override",
    {
      title: "Set Macro Override",
      description: "Manually locks the macro targets to specific values, excluding them from recalculation until unlocked (from the dashboard).",
      inputSchema: {
        protein_g: z.number().nonnegative(),
        carb_g: z.number().nonnegative(),
        fat_g: z.number().nonnegative(),
      },
    },
    async ({ protein_g, carb_g, fat_g }, extra) => {
      const userId = resolveUserId(extra);

      const { data: goals } = await supabase.from("goals").select("user_id").eq("user_id", userId).maybeSingle();
      if (!goals) {
        return { content: [{ type: "text", text: "No goals set yet — call set_goals first." }], isError: true };
      }

      const { error } = await supabase.from("goals").update({ protein_g, carb_g, fat_g, macros_locked: true }).eq("user_id", userId);

      if (error) {
        return { content: [{ type: "text", text: `Error setting override: ${error.message}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Macro targets locked at ${protein_g}g protein, ${carb_g}g carbs, ${fat_g}g fat.` }] };
    }
  );

  server.registerTool(
    "recalculate_targets",
    {
      title: "Recalculate Targets",
      description:
        "Manually re-runs the deterministic calorie/macro calculation (spec §5) from the current profile, latest logged weight, and goals. Locked values are left untouched. This is the on-demand counterpart to the weekly adaptive recalibration job (not yet built).",
      inputSchema: {},
    },
    async (_args, extra) => {
      const userId = resolveUserId(extra);

      const recalc = await recalculateAndSaveGoals(supabase, userId);
      if (!recalc.ok) {
        return { content: [{ type: "text", text: recalc.reason }], isError: true };
      }
      return { content: [{ type: "text", text: recalc.summary }] };
    }
  );

  server.registerTool(
    "log_weight",
    {
      title: "Log Weight",
      description: "Logs a weight measurement, in the user's profile weight_unit (kg if no profile is set yet).",
      inputSchema: {
        value: z.number().positive().describe("Weight, in the profile's weight_unit"),
        logged_at: z.string().optional().describe("ISO timestamp; defaults to now"),
      },
    },
    async ({ value, logged_at }, extra) => {
      const userId = resolveUserId(extra);

      const { data: profile } = await supabase.from("profile").select("weight_unit").eq("user_id", userId).maybeSingle();
      const weightUnit = profile?.weight_unit ?? "kg";
      const weight_kg = weightUnit === "lb" ? value * KG_PER_LB : value;

      const { error } = await supabase
        .from("weight_logs")
        .insert({ user_id: userId, weight_kg, logged_at: logged_at ?? new Date().toISOString() });

      if (error) {
        return { content: [{ type: "text", text: `Error logging weight: ${error.message}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Logged weight: ${value}${weightUnit}.` }] };
    }
  );

  server.registerTool(
    "get_weight_trends",
    {
      title: "Get Weight Trends",
      description: "Lists recent weight log entries and the net change over the window, in the profile's weight_unit.",
      inputSchema: {
        days: z.number().int().positive().optional().describe("Lookback window in days; defaults to 30"),
      },
    },
    async ({ days }, extra) => {
      const userId = resolveUserId(extra);

      const { data: profile } = await supabase.from("profile").select("weight_unit, timezone").eq("user_id", userId).maybeSingle();
      const weightUnit = profile?.weight_unit ?? "kg";
      const timezone = profile?.timezone ?? "UTC";
      const window = days ?? 30;

      const { data: logs, error } = await supabase
        .from("weight_logs")
        .select("weight_kg, logged_at")
        .eq("user_id", userId)
        .gte("logged_at", DateTime.now().minus({ days: window }).toUTC().toISO()!)
        .order("logged_at", { ascending: true });

      if (error) {
        return { content: [{ type: "text", text: `Error fetching weight trends: ${error.message}` }], isError: true };
      }
      if (!logs || logs.length === 0) {
        return { content: [{ type: "text", text: `No weight logged in the last ${window} days.` }] };
      }

      const toDisplay = (kg: number) => (weightUnit === "lb" ? kg / KG_PER_LB : kg);

      const lines = logs.map((l) => {
        const local = DateTime.fromISO(l.logged_at).setZone(timezone).toFormat("yyyy-LL-dd HH:mm");
        return `${local}: ${round1(toDisplay(l.weight_kg))}${weightUnit}`;
      });

      const first = toDisplay(logs[0].weight_kg);
      const last = toDisplay(logs[logs.length - 1].weight_kg);
      const delta = round1(last - first);

      return {
        content: [
          {
            type: "text",
            text: `Weight trend, last ${window} days (${weightUnit}): ${round1(first)} → ${round1(last)} (${delta >= 0 ? "+" : ""}${delta})\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "log_water",
    {
      title: "Log Water",
      description: "Logs a water intake amount, in milliliters.",
      inputSchema: {
        ml: z.number().int().positive(),
        logged_at: z.string().optional().describe("ISO timestamp; defaults to now"),
      },
    },
    async ({ ml, logged_at }, extra) => {
      const userId = resolveUserId(extra);

      const { error } = await supabase.from("water_logs").insert({ user_id: userId, ml, logged_at: logged_at ?? new Date().toISOString() });

      if (error) {
        return { content: [{ type: "text", text: `Error logging water: ${error.message}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Logged ${ml}ml of water.` }] };
    }
  );

  server.registerTool(
    "get_water_today",
    {
      title: "Get Water Today",
      description: "Total water logged today, in the user's profile timezone.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const userId = resolveUserId(extra);
      const timezone = await getUserTimezone(supabase, userId);
      const today = DateTime.now().setZone(timezone);

      const { data: logs, error } = await supabase
        .from("water_logs")
        .select("ml")
        .eq("user_id", userId)
        .gte("logged_at", today.startOf("day").toUTC().toISO()!)
        .lte("logged_at", today.endOf("day").toUTC().toISO()!)
        .order("logged_at", { ascending: true });

      if (error) {
        return { content: [{ type: "text", text: `Error fetching water: ${error.message}` }], isError: true };
      }

      const total = (logs ?? []).reduce((sum, l) => sum + l.ml, 0);

      return {
        content: [
          { type: "text", text: `Water today (${timezone}): ${total}ml${logs && logs.length > 0 ? ` across ${logs.length} entries` : ""}.` },
        ],
      };
    }
  );

  server.registerTool(
    "get_nutrition_summary",
    {
      title: "Get Nutrition Summary",
      description: "Daily calorie/macro totals and period averages for an inclusive date range, interpreted in the profile timezone.",
      inputSchema: {
        start_date: z.string().describe("Start date, inclusive, YYYY-MM-DD"),
        end_date: z.string().describe("End date, inclusive, YYYY-MM-DD"),
      },
    },
    async ({ start_date, end_date }, extra) => {
      const userId = resolveUserId(extra);
      const timezone = await getUserTimezone(supabase, userId);
      const start = DateTime.fromISO(start_date, { zone: timezone });
      const end = DateTime.fromISO(end_date, { zone: timezone });

      if (!start.isValid) {
        return { content: [{ type: "text", text: `Invalid start_date "${start_date}": ${start.invalidReason}` }], isError: true };
      }
      if (!end.isValid) {
        return { content: [{ type: "text", text: `Invalid end_date "${end_date}": ${end.invalidReason}` }], isError: true };
      }
      if (end < start) {
        return { content: [{ type: "text", text: `end_date (${end_date}) is before start_date (${start_date}).` }], isError: true };
      }

      const { data: entries, error } = await fetchFoodEntriesInRange(
        supabase,
        userId,
        start.startOf("day").toUTC().toISO()!,
        end.endOf("day").toUTC().toISO()!
      );

      if (error) {
        return { content: [{ type: "text", text: `Error fetching entries: ${error.message}` }], isError: true };
      }
      if (!entries || entries.length === 0) {
        return { content: [{ type: "text", text: `No entries logged from ${start_date} to ${end_date}.` }] };
      }

      const byDay = new Map<string, { calories: number; protein_g: number; carb_g: number; fat_g: number }>();
      for (const e of entries) {
        const day = DateTime.fromISO(e.logged_at).setZone(timezone).toFormat("yyyy-LL-dd");
        const acc = byDay.get(day) ?? { calories: 0, protein_g: 0, carb_g: 0, fat_g: 0 };
        acc.calories += e.calories;
        acc.protein_g += e.protein_g;
        acc.carb_g += e.carb_g;
        acc.fat_g += e.fat_g;
        byDay.set(day, acc);
      }

      const dayEntries = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
      const lines = dayEntries.map(
        ([day, t]) => `${day}: ${round1(t.calories)} kcal, ${round1(t.protein_g)}g protein, ${round1(t.carb_g)}g carbs, ${round1(t.fat_g)}g fat`
      );

      const numDays = dayEntries.length;
      const avg = dayEntries.reduce(
        (acc, [, t]) => ({
          calories: acc.calories + t.calories / numDays,
          protein_g: acc.protein_g + t.protein_g / numDays,
          carb_g: acc.carb_g + t.carb_g / numDays,
          fat_g: acc.fat_g + t.fat_g / numDays,
        }),
        { calories: 0, protein_g: 0, carb_g: 0, fat_g: 0 }
      );

      const summary = `Nutrition summary ${start_date} to ${end_date} (${timezone}), ${numDays} logged day(s), daily average: ${round1(avg.calories)} kcal, ${round1(avg.protein_g)}g protein, ${round1(avg.carb_g)}g carbs, ${round1(avg.fat_g)}g fat\n\n${lines.join("\n")}`;

      return { content: [{ type: "text", text: summary }] };
    }
  );

  server.registerTool(
    "get_trends",
    {
      title: "Get Trends",
      description: "Combined overview: weight change and average daily nutrition over a lookback window (defaults to 30 days).",
      inputSchema: {
        days: z.number().int().positive().optional().describe("Lookback window in days; defaults to 30"),
      },
    },
    async ({ days }, extra) => {
      const userId = resolveUserId(extra);
      const timezone = await getUserTimezone(supabase, userId);
      const window = days ?? 30;
      const since = DateTime.now().minus({ days: window });

      const { data: profile } = await supabase.from("profile").select("weight_unit").eq("user_id", userId).maybeSingle();
      const weightUnit = profile?.weight_unit ?? "kg";
      const toDisplay = (kg: number) => (weightUnit === "lb" ? kg / KG_PER_LB : kg);

      const { data: weightLogs } = await supabase
        .from("weight_logs")
        .select("weight_kg, logged_at")
        .eq("user_id", userId)
        .gte("logged_at", since.toUTC().toISO()!)
        .order("logged_at", { ascending: true });

      const weightLine =
        weightLogs && weightLogs.length > 0
          ? `Weight: ${round1(toDisplay(weightLogs[0].weight_kg))} → ${round1(toDisplay(weightLogs[weightLogs.length - 1].weight_kg))} ${weightUnit} (${weightLogs.length} entries)`
          : "Weight: no entries logged in this window.";

      const { data: entries } = await fetchFoodEntriesInRange(supabase, userId, since.toUTC().toISO()!, DateTime.now().toUTC().toISO()!);

      let nutritionLine: string;
      if (entries && entries.length > 0) {
        const loggedDays = new Set(entries.map((e) => DateTime.fromISO(e.logged_at).setZone(timezone).toFormat("yyyy-LL-dd"))).size;
        const totals = entries.reduce(
          (acc, e) => ({
            calories: acc.calories + e.calories,
            protein_g: acc.protein_g + e.protein_g,
            carb_g: acc.carb_g + e.carb_g,
            fat_g: acc.fat_g + e.fat_g,
          }),
          { calories: 0, protein_g: 0, carb_g: 0, fat_g: 0 }
        );
        nutritionLine = `Nutrition: ${loggedDays} day(s) logged, daily average ${round1(totals.calories / loggedDays)} kcal, ${round1(totals.protein_g / loggedDays)}g protein, ${round1(totals.carb_g / loggedDays)}g carbs, ${round1(totals.fat_g / loggedDays)}g fat`;
      } else {
        nutritionLine = "Nutrition: no entries logged in this window.";
      }

      return { content: [{ type: "text", text: `Trends over the last ${window} days:\n${weightLine}\n${nutritionLine}` }] };
    }
  );

  server.registerTool(
    "lookup_barcode",
    {
      title: "Lookup Barcode",
      description: "Looks up a product's nutrition facts by barcode via Open Food Facts. Figures are per 100g/100ml as reported by the product's data.",
      inputSchema: {
        barcode: z.string().describe("UPC/EAN barcode, digits only"),
      },
    },
    async ({ barcode }) => {
      let res: Response;
      try {
        res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
      } catch (err) {
        return { content: [{ type: "text", text: `Barcode lookup failed: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }

      if (!res.ok) {
        return { content: [{ type: "text", text: `Barcode lookup failed: HTTP ${res.status}` }], isError: true };
      }

      const data = await res.json();
      if (data.status !== 1 || !data.product) {
        return { content: [{ type: "text", text: `No product found for barcode ${barcode}.` }] };
      }

      const p = data.product;
      const n = p.nutriments ?? {};

      return {
        content: [
          {
            type: "text",
            text: `${p.product_name ?? "Unknown product"}${p.brands ? ` (${p.brands})` : ""} — per 100g: ${n["energy-kcal_100g"] ?? "?"} kcal, ${n["proteins_100g"] ?? "?"}g protein, ${n["carbohydrates_100g"] ?? "?"}g carbs, ${n["fat_100g"] ?? "?"}g fat, ${n["fiber_100g"] ?? "?"}g fiber, ${n["sugars_100g"] ?? "?"}g sugar.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "set_timezone",
    {
      title: "Set Timezone",
      description: "Sets just the user's timezone, used to bucket 'today'/date-based queries. For full profile setup use set_profile instead.",
      inputSchema: {
        timezone: z.string().describe("IANA timezone name, e.g. 'Europe/London'"),
      },
    },
    async ({ timezone }, extra) => {
      const userId = resolveUserId(extra);

      if (!IANAZone.isValidZone(timezone)) {
        return { content: [{ type: "text", text: `Invalid timezone "${timezone}".` }], isError: true };
      }

      const { error } = await supabase.from("profile").upsert({ user_id: userId, timezone }, { onConflict: "user_id" });

      if (error) {
        return { content: [{ type: "text", text: `Error setting timezone: ${error.message}` }], isError: true };
      }

      return { content: [{ type: "text", text: `Timezone set to ${timezone}.` }] };
    }
  );

  server.registerTool(
    "get_profile",
    {
      title: "Get Profile",
      description: "Returns the user's current profile settings.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const userId = resolveUserId(extra);

      const { data: profile, error } = await supabase.from("profile").select("*").eq("user_id", userId).maybeSingle();

      if (error) {
        return { content: [{ type: "text", text: `Error fetching profile: ${error.message}` }], isError: true };
      }
      if (!profile) {
        return { content: [{ type: "text", text: "No profile set yet — call set_profile (or set_timezone) first." }] };
      }

      const parts = [
        profile.age != null ? `${profile.age}yo` : null,
        profile.sex,
        profile.height_cm != null ? `${profile.height_cm}cm` : null,
        profile.activity_level ? `${profile.activity_level} activity` : null,
      ].filter(Boolean);

      return {
        content: [
          {
            type: "text",
            text: `${parts.length > 0 ? parts.join(", ") + ". " : ""}Units: ${profile.weight_unit}/${profile.height_unit}. Timezone: ${profile.timezone}.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "export_all_data",
    {
      title: "Export All Data",
      description:
        "Returns everything stored for this account as JSON: profile, goals, goal history, every food entry with its ingredients, saved meals, and water and weight logs. Use it when someone wants a copy of their data, or before they delete their account.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async (_args, extra) => {
      const userId = resolveUserId(extra);

      try {
        const data = await exportAccountData(supabase, userId);
        const counts = `${data.food_entries.length} food entries, ${data.saved_meals.length} saved meals, ${data.weight_logs.length} weight logs, ${data.water_logs.length} water logs`;
        return { content: [{ type: "text", text: `Full export (${counts}):\n\n${JSON.stringify(data, null, 2)}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error exporting data: ${(error as Error).message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "delete_account",
    {
      title: "Delete Account",
      description:
        'Permanently deletes this account and everything in it: meals, saved meals, weight, water, goals, profile, and every AI app connection. This cannot be undone. Offer export_all_data first, and only call this after the person has clearly confirmed they want it gone. The confirm argument must be exactly "DELETE MY ACCOUNT".',
      inputSchema: {
        confirm: z.literal("DELETE MY ACCOUNT").describe('Must be the exact text "DELETE MY ACCOUNT"'),
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (_args, extra) => {
      const userId = resolveUserId(extra);

      try {
        await deleteAccount(supabase, userId);
        return {
          content: [
            {
              type: "text",
              text: "Account deleted. Every meal, saved meal, weight, water and goal record is gone, along with the sign-in itself. You can remove the CalTrack connector from this app now — it no longer has an account to reach.",
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Error deleting account: ${(error as Error).message}` }], isError: true };
      }
    }
  );
}
