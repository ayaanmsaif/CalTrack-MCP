# CalTrack — Supabase schema (step 1)

Implements §3 of the CalTrack spec: all ten tables, row level security, the
ingredient-aggregate triggers, and the `log_saved_meal` RPC.

## Files

- `supabase/migrations/20260828000001_schema.sql` — enums, tables, indexes
- `supabase/migrations/20260828000002_triggers.sql` — aggregate sync + user_id denormalization
- `supabase/migrations/20260828000003_rls_policies.sql` — row level security
- `supabase/migrations/20260828000004_functions.sql` — the `log_saved_meal` RPC
- `supabase/seed.sql` — local dev sample data + a smoke test of the trigger/RPC

## Applying this

Drop the `supabase/` folder into a Supabase project (run `supabase init` first
if starting fresh), then:

```
supabase start      # local Postgres + Auth + Storage via Docker
supabase db reset    # applies migrations, then runs seed.sql
```

Verify with the queries commented at the bottom of `seed.sql`.

## Design decisions made while writing this

- **Canonical units.** Weight is stored in `kg`, height in `cm` — the column
  names say so explicitly (`weight_kg`, `height_cm`, `goal_weight_kg`).
  `profile.weight_unit` / `profile.height_unit` are display and input
  preferences only; conversion happens at the API/MCP boundary, not in the
  database. This wasn't spelled out in the spec doc, so flagging it here.

- **Aggregate columns are trigger-owned, not just trigger-updated.** A
  `BEFORE INSERT OR UPDATE` trigger on `food_entries` / `saved_meals`
  recomputes the aggregate from their ingredient rows on every write — so
  even a direct client `UPDATE food_entries SET calories = ...` gets silently
  overridden with the real sum. This is stricter than the version described
  earlier in chat (which only synced when ingredients changed); this version
  can't drift no matter which layer writes to it.

- **`user_id` is denormalized onto both ingredient tables**, set by a
  `BEFORE INSERT` trigger copying it from the parent row. Keeps every RLS
  policy a flat `auth.uid() = user_id` with no joins, and a client can't
  spoof an ingredient onto someone else's entry even if it tries to.

- **`goal_adjustments_log` is select+insert only from the client** — it's an
  audit trail. The recalibration job (step 6) will write to it using the
  Supabase service role key, which bypasses RLS.

## Not in this step

The MCP server, the OAuth/DCR auth layer, the dashboard frontend, the
calorie/macro calculation, and the recalibration job are all later steps per
§11 of the spec — this is schema + RLS + the two pieces of real logic
(aggregate sync, saved-meal recall) only.
