-- CalTrack triggers: aggregate sync (ingredients -> parent) and the
-- user_id denormalization that keeps RLS policies join-free.

-- Denormalize user_id onto ingredient rows so RLS policies don't need joins,
-- and so a client can never spoof an ingredient onto someone else's entry —
-- this always overrides whatever the client sends with the parent's real owner.

create or replace function set_food_entry_ingredient_user_id()
returns trigger as $$
begin
  select user_id into new.user_id from food_entries where id = new.entry_id;
  return new;
end;
$$ language plpgsql;

create trigger food_entry_ingredients_set_user_id
before insert on food_entry_ingredients
for each row execute function set_food_entry_ingredient_user_id();

create or replace function set_saved_meal_ingredient_user_id()
returns trigger as $$
begin
  select user_id into new.user_id from saved_meals where id = new.saved_meal_id;
  return new;
end;
$$ language plpgsql;

create trigger saved_meal_ingredients_set_user_id
before insert on saved_meal_ingredients
for each row execute function set_saved_meal_ingredient_user_id();

-- Aggregate sync: food_entries recomputes its own totals from
-- food_entry_ingredients on every insert/update. This also means a client
-- writing directly to food_entries.calories gets silently overridden with
-- the real sum — the totals can never drift from the breakdown, regardless
-- of which layer (dashboard, MCP server, future feature) writes to it.

create or replace function recompute_food_entry_totals()
returns trigger as $$
begin
  select
    coalesce(sum(calories), 0), coalesce(sum(protein_g), 0), coalesce(sum(carb_g), 0),
    coalesce(sum(fat_g), 0), coalesce(sum(fiber_g), 0), coalesce(sum(sugar_g), 0)
  into new.calories, new.protein_g, new.carb_g, new.fat_g, new.fiber_g, new.sugar_g
  from food_entry_ingredients where entry_id = new.id;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger food_entries_recompute
before insert or update on food_entries
for each row execute function recompute_food_entry_totals();

-- When an ingredient row changes, "touch" its parent — this fires the
-- BEFORE UPDATE trigger above, which does the actual recomputation. One
-- source of truth for the sum logic instead of duplicating it in two places.

create or replace function touch_parent_food_entry()
returns trigger as $$
begin
  update food_entries set updated_at = now()
  where id = coalesce(new.entry_id, old.entry_id);
  return null;
end;
$$ language plpgsql;

create trigger food_entry_ingredients_touch_parent
after insert or update or delete on food_entry_ingredients
for each row execute function touch_parent_food_entry();

-- Same pattern for saved_meals / saved_meal_ingredients.

create or replace function recompute_saved_meal_totals()
returns trigger as $$
begin
  select
    coalesce(sum(calories), 0), coalesce(sum(protein_g), 0), coalesce(sum(carb_g), 0),
    coalesce(sum(fat_g), 0), coalesce(sum(fiber_g), 0), coalesce(sum(sugar_g), 0)
  into new.calories, new.protein_g, new.carb_g, new.fat_g, new.fiber_g, new.sugar_g
  from saved_meal_ingredients where saved_meal_id = new.id;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger saved_meals_recompute
before insert or update on saved_meals
for each row execute function recompute_saved_meal_totals();

create or replace function touch_parent_saved_meal()
returns trigger as $$
begin
  update saved_meals set updated_at = now()
  where id = coalesce(new.saved_meal_id, old.saved_meal_id);
  return null;
end;
$$ language plpgsql;

create trigger saved_meal_ingredients_touch_parent
after insert or update or delete on saved_meal_ingredients
for each row execute function touch_parent_saved_meal();
