import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "../app/AuthProvider";
import { dayKeyInZone, isValidTimeZone, queryWindow } from "./dates";
import { num } from "./format";
import type { FoodEntry, GoalAdjustment, Goals, Ingredient, Profile, SavedMeal, WaterLog, WeightLog } from "./types";

export type DayEntry = FoodEntry & { dayKey: string };
export type DayWater = WaterLog & { dayKey: string };

const MACRO_KEYS = ["calories", "protein_g", "carb_g", "fat_g", "fiber_g", "sugar_g"] as const;

const numOrNull = (v: unknown) => (v == null ? null : num(v));

function withMacros<T>(row: T): T {
  const out = { ...row } as Record<string, unknown>;
  for (const k of MACRO_KEYS) out[k] = num(out[k]);
  return out as T;
}

function normalizeIngredients(rows: Ingredient[] | null | undefined): Ingredient[] {
  return [...(rows ?? [])]
    .map((i) => ({ ...withMacros(i), quantity: num(i.quantity), sort_order: num(i.sort_order) }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function useUserId() {
  return useAuth().session?.user.id ?? null;
}

export function useProfile() {
  const uid = useUserId();
  return useQuery({
    queryKey: ["profile", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile")
        .select("height_cm, age, sex, activity_level, weight_unit, height_unit, timezone")
        .eq("user_id", uid!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, height_cm: numOrNull(data.height_cm), age: numOrNull(data.age) } as Profile;
    },
  });
}

// Matches the MCP server's own bucketing: profile timezone, or UTC if none.
export function useTimezone() {
  const { data, isPending } = useProfile();
  const tz = data?.timezone;
  const valid = isValidTimeZone(tz);
  return {
    tz: valid ? tz : "UTC",
    ready: !isPending,
    unset: !data || !valid || tz === "UTC",
  };
}

export function useGoals() {
  const uid = useUserId();
  return useQuery({
    queryKey: ["goals", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select(
          "goal_type, goal_weight_kg, weekly_rate_kg, daily_calories, protein_g, carb_g, fat_g, calories_locked, macros_locked, last_recalculated_at"
        )
        .eq("user_id", uid!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        goal_weight_kg: numOrNull(data.goal_weight_kg),
        weekly_rate_kg: num(data.weekly_rate_kg),
        daily_calories: numOrNull(data.daily_calories),
        protein_g: numOrNull(data.protein_g),
        carb_g: numOrNull(data.carb_g),
        fat_g: numOrNull(data.fat_g),
      } as Goals;
    },
  });
}

export function useEntries(startKey: string, endKey: string, tz: string, enabled = true, refetchMs?: number) {
  const uid = useUserId();
  return useQuery({
    queryKey: ["entries", uid, startKey, endKey, tz],
    enabled: !!uid && enabled,
    placeholderData: keepPreviousData,
    refetchInterval: refetchMs,
    queryFn: async (): Promise<DayEntry[]> => {
      const { from, to } = queryWindow(startKey, endKey);
      const { data, error } = await supabase
        .from("food_entries")
        .select(
          "id, description, meal_type, logged_at, source, saved_meal_id, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g, food_entry_ingredients(id, name, quantity, unit, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g, sort_order)"
        )
        .eq("user_id", uid!)
        .gte("logged_at", from)
        .lt("logged_at", to)
        .order("logged_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as FoodEntry[])
        .map((e) => ({
          ...withMacros(e),
          food_entry_ingredients: normalizeIngredients(e.food_entry_ingredients),
          dayKey: dayKeyInZone(new Date(e.logged_at), tz),
        }))
        .filter((e) => e.dayKey >= startKey && e.dayKey <= endKey);
    },
  });
}

export function useWater(startKey: string, endKey: string, tz: string, enabled = true) {
  const uid = useUserId();
  return useQuery({
    queryKey: ["water", uid, startKey, endKey, tz],
    enabled: !!uid && enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DayWater[]> => {
      const { from, to } = queryWindow(startKey, endKey);
      const { data, error } = await supabase
        .from("water_logs")
        .select("id, ml, logged_at")
        .eq("user_id", uid!)
        .gte("logged_at", from)
        .lt("logged_at", to)
        .order("logged_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as WaterLog[])
        .map((w) => ({ ...w, ml: num(w.ml), dayKey: dayKeyInZone(new Date(w.logged_at), tz) }))
        .filter((w) => w.dayKey >= startKey && w.dayKey <= endKey);
    },
  });
}

export function useWeights(sinceIso: string) {
  const uid = useUserId();
  return useQuery({
    queryKey: ["weights", uid, sinceIso.slice(0, 10)],
    enabled: !!uid,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<WeightLog[]> => {
      const { data, error } = await supabase
        .from("weight_logs")
        .select("id, weight_kg, logged_at")
        .eq("user_id", uid!)
        .gte("logged_at", sinceIso)
        .order("logged_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as WeightLog[]).map((w) => ({ ...w, weight_kg: num(w.weight_kg) }));
    },
  });
}

export function useLatestWeight() {
  const uid = useUserId();
  return useQuery({
    queryKey: ["latest-weight", uid],
    enabled: !!uid,
    queryFn: async (): Promise<WeightLog | null> => {
      const { data, error } = await supabase
        .from("weight_logs")
        .select("id, weight_kg, logged_at")
        .eq("user_id", uid!)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? ({ ...data, weight_kg: num(data.weight_kg) } as WeightLog) : null;
    },
  });
}

export function useSavedMeals() {
  const uid = useUserId();
  return useQuery({
    queryKey: ["saved-meals", uid],
    enabled: !!uid,
    queryFn: async (): Promise<SavedMeal[]> => {
      const { data, error } = await supabase
        .from("saved_meals")
        .select(
          "id, name, description, created_at, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g, saved_meal_ingredients(id, name, quantity, unit, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g, sort_order)"
        )
        .eq("user_id", uid!)
        .order("name");
      if (error) throw error;
      return (data as unknown as SavedMeal[]).map((m) => ({
        ...withMacros(m),
        saved_meal_ingredients: normalizeIngredients(m.saved_meal_ingredients),
      }));
    },
  });
}

export function useGoalHistory() {
  const uid = useUserId();
  return useQuery({
    queryKey: ["goal-history", uid],
    enabled: !!uid,
    queryFn: async (): Promise<GoalAdjustment[]> => {
      const { data, error } = await supabase
        .from("goal_adjustments_log")
        .select("id, adjusted_at, old_calories, new_calories, old_protein_g, new_protein_g, old_carb_g, new_carb_g, old_fat_g, new_fat_g, basis")
        .eq("user_id", uid!)
        .order("adjusted_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as GoalAdjustment[];
    },
  });
}

export function useHasAnyEntries() {
  const uid = useUserId();
  return useQuery({
    queryKey: ["has-entries", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("food_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid!);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}
