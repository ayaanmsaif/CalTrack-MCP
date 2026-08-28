-- CalTrack schema: enums, tables, and indexes
-- Canonical units: weight stored in kg, height stored in cm.
-- profile.weight_unit / profile.height_unit are display/input preferences only —
-- conversion happens at the API/MCP boundary, not in the database.

create extension if not exists pgcrypto;

-- Enums --------------------------------------------------------------------

create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');

create type food_entry_source as enum (
  'text_estimated',
  'image_estimated',
  'barcode',
  'saved_meal',
  'manual'
);

create type saved_meal_source as enum ('text', 'image', 'manual');

create type goal_type as enum ('lose_weight', 'maintain', 'gain_weight', 'gain_muscle');

create type biological_sex as enum ('male', 'female');

create type activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');

create type weight_unit as enum ('kg', 'lb');

create type height_unit as enum ('cm', 'in');

-- Profile --------------------------------------------------------------------

create table profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  height_cm numeric,
  age smallint,
  sex biological_sex,
  activity_level activity_level,
  weight_unit weight_unit not null default 'kg',
  height_unit height_unit not null default 'cm',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Weight & water logs ----------------------------------------------------------

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric not null,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ml integer not null,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Goals & adjustment history ---------------------------------------------------

create table goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_type goal_type not null,
  goal_weight_kg numeric,
  weekly_rate_kg numeric not null default 0, -- signed: negative = loss, positive = gain
  daily_calories numeric,
  protein_g numeric,
  carb_g numeric,
  fat_g numeric,
  calories_locked boolean not null default false,
  macros_locked boolean not null default false,
  last_recalculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table goal_adjustments_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  adjusted_at timestamptz not null default now(),
  old_calories numeric,
  new_calories numeric,
  old_protein_g numeric,
  new_protein_g numeric,
  old_carb_g numeric,
  new_carb_g numeric,
  old_fat_g numeric,
  new_fat_g numeric,
  basis jsonb, -- e.g. { "avg_weight_delta_kg": -0.3, "implied_tdee": 2450, "days_logged": 6 }
  created_at timestamptz not null default now()
);

-- Saved meals (templates) --------------------------------------------------------

create table saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_from saved_meal_source not null default 'manual',
  -- aggregate columns below are maintained by trigger, never written directly
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carb_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric not null default 0,
  sugar_g numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table saved_meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references saved_meals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- denormalized, set by trigger
  name text not null,
  quantity numeric not null,
  unit text,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carb_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric not null default 0,
  sugar_g numeric not null default 0,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Food entries (logged meals/snacks/single items) --------------------------------

create table food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  meal_type meal_type not null,
  logged_at timestamptz not null default now(),
  source food_entry_source not null default 'manual',
  saved_meal_id uuid references saved_meals(id) on delete set null,
  -- aggregate columns below are maintained by trigger, never written directly
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carb_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric not null default 0,
  sugar_g numeric not null default 0,
  photo_url text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table food_entry_ingredients (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references food_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- denormalized, set by trigger
  name text not null,
  quantity numeric not null,
  unit text,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carb_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric not null default 0,
  sugar_g numeric not null default 0,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes -------------------------------------------------------------------------

create index idx_food_entries_user_logged_at on food_entries (user_id, logged_at desc);
create index idx_food_entries_saved_meal_id on food_entries (saved_meal_id);
create unique index idx_food_entries_user_idempotency on food_entries (user_id, idempotency_key) where idempotency_key is not null;
create index idx_food_entry_ingredients_entry_id on food_entry_ingredients (entry_id);
create index idx_weight_logs_user_logged_at on weight_logs (user_id, logged_at desc);
create index idx_water_logs_user_logged_at on water_logs (user_id, logged_at desc);
create index idx_saved_meal_ingredients_saved_meal_id on saved_meal_ingredients (saved_meal_id);
create index idx_goal_adjustments_log_user_adjusted_at on goal_adjustments_log (user_id, adjusted_at desc);
