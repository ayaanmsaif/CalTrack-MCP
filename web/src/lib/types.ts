export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type Macros = {
  calories: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
};

export type Ingredient = Macros & {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  sort_order: number;
};

export type FoodEntry = Macros & {
  id: string;
  description: string;
  meal_type: MealType;
  logged_at: string;
  source: "text_estimated" | "image_estimated" | "barcode" | "saved_meal" | "manual";
  saved_meal_id: string | null;
  food_entry_ingredients: Ingredient[];
};

export type Goals = {
  goal_type: "lose_weight" | "maintain" | "gain_weight" | "gain_muscle";
  goal_weight_kg: number | null;
  weekly_rate_kg: number;
  daily_calories: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  calories_locked: boolean;
  macros_locked: boolean;
  last_recalculated_at: string | null;
};

export type Profile = {
  height_cm: number | null;
  age: number | null;
  sex: "male" | "female" | null;
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active" | null;
  weight_unit: "kg" | "lb";
  height_unit: "cm" | "in";
  timezone: string;
};

export type WeightLog = { id: string; weight_kg: number; logged_at: string };
export type WaterLog = { id: string; ml: number; logged_at: string };

export type SavedMeal = Macros & {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  saved_meal_ingredients: Ingredient[];
};

export type GoalAdjustment = {
  id: string;
  adjusted_at: string;
  old_calories: number | null;
  new_calories: number | null;
  old_protein_g: number | null;
  new_protein_g: number | null;
  old_carb_g: number | null;
  new_carb_g: number | null;
  old_fat_g: number | null;
  new_fat_g: number | null;
  basis: Record<string, unknown> | null;
};
