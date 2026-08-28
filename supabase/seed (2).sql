-- Local dev seed data. Do NOT run this against a hosted or production
-- project — it inserts directly into auth.users, which should only happen
-- through Supabase's real signup flow outside of local development.

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated'
);

insert into profile (user_id, height_cm, age, sex, activity_level, timezone)
values ('11111111-1111-1111-1111-111111111111', 178, 29, 'male', 'moderate', 'Europe/London');

insert into weight_logs (user_id, weight_kg, logged_at)
values
  ('11111111-1111-1111-1111-111111111111', 82.4, now() - interval '6 days'),
  ('11111111-1111-1111-1111-111111111111', 82.1, now() - interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', 81.9, now());

insert into goals (user_id, goal_type, goal_weight_kg, weekly_rate_kg)
values ('11111111-1111-1111-1111-111111111111', 'lose_weight', 76, -0.4);

-- A saved meal: "Beef mince with potatoes" — three ingredients. The
-- aggregate columns start at 0 and get filled in automatically by the
-- trigger the moment the ingredient rows below are inserted.

insert into saved_meals (id, user_id, name, created_from)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Beef mince with potatoes',
  'text'
);

insert into saved_meal_ingredients (saved_meal_id, name, quantity, unit, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g, sort_order)
values
  ('22222222-2222-2222-2222-222222222222', 'Beef mince, 20%', 100, 'g',    250, 21, 0, 18, 0, 0,   0),
  ('22222222-2222-2222-2222-222222222222', 'Potatoes',        50,  'g',    40,  1,  9, 0,  1, 0.5, 1),
  ('22222222-2222-2222-2222-222222222222', 'Ghee',            1,   'tbsp', 120, 0,  0, 14, 0, 0,   2);

-- Recall it via the RPC, doubled — exercises the copy-and-scale logic end to end.
select log_saved_meal(
  '22222222-2222-2222-2222-222222222222'::uuid,
  'dinner'::meal_type,
  2
);

-- Verification queries (run these manually after seeding):
--   select name, calories, protein_g from saved_meals;
--     -> expect 410 calories, 22g protein (the sum of the three ingredients)
--   select description, calories, protein_g from food_entries;
--     -> expect 820 calories, 44g protein (2x, from the quantity multiplier)
--   select name, quantity, calories from food_entry_ingredients;
--     -> expect every quantity and macro doubled from the saved meal's originals
