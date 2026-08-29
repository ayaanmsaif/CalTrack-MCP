-- CalTrack row level security: every table scoped to auth.uid() = user_id.
-- goal_adjustments_log is intentionally select+insert only from the client —
-- it's an audit trail, not something a user edits. The backend recalibration
-- job (step 6) writes to it using the Supabase service role key, which
-- bypasses RLS entirely, as is standard for privileged server-side jobs.

alter table profile enable row level security;
create policy "own profile" on profile for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table weight_logs enable row level security;
create policy "own weight logs" on weight_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table water_logs enable row level security;
create policy "own water logs" on water_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table goals enable row level security;
create policy "own goals" on goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table goal_adjustments_log enable row level security;
create policy "read own goal adjustments" on goal_adjustments_log for select
  using (auth.uid() = user_id);
create policy "insert own goal adjustments" on goal_adjustments_log for insert
  with check (auth.uid() = user_id);

alter table saved_meals enable row level security;
create policy "own saved meals" on saved_meals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table saved_meal_ingredients enable row level security;
create policy "own saved meal ingredients" on saved_meal_ingredients for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table food_entries enable row level security;
create policy "own food entries" on food_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table food_entry_ingredients enable row level security;
create policy "own food entry ingredients" on food_entry_ingredients for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
