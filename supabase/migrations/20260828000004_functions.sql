-- log_saved_meal: copies a saved meal's ingredients into a new food_entries
-- row, scaled by quantity. This is a copy, not a reference — editing the
-- saved meal later doesn't retroactively change meals already logged from
-- it, and editing a past logged meal doesn't touch the saved template.

create or replace function log_saved_meal(
  p_saved_meal_id uuid,
  p_meal_type meal_type,
  p_quantity numeric default 1,
  p_logged_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_entry_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  if not exists (
    select 1 from saved_meals where id = p_saved_meal_id and user_id = v_user_id
  ) then
    raise exception 'saved meal not found';
  end if;

  insert into food_entries (user_id, description, meal_type, logged_at, source, saved_meal_id)
  select v_user_id, coalesce(description, name), p_meal_type, p_logged_at, 'saved_meal', id
  from saved_meals where id = p_saved_meal_id
  returning id into v_new_entry_id;

  insert into food_entry_ingredients (
    entry_id, name, quantity, unit, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g, sort_order
  )
  select
    v_new_entry_id, name, quantity * p_quantity, unit,
    calories * p_quantity, protein_g * p_quantity, carb_g * p_quantity,
    fat_g * p_quantity, fiber_g * p_quantity, sugar_g * p_quantity, sort_order
  from saved_meal_ingredients
  where saved_meal_id = p_saved_meal_id;

  return v_new_entry_id;
end;
$$;

grant execute on function log_saved_meal(uuid, meal_type, numeric, timestamptz) to authenticated;
