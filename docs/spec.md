# CalTrack — Product & Technical Specification (v1, locked)

## 1. Overview

CalTrack is a nutrition-tracking system controllable through natural language (Claude, ChatGPT, or any MCP-compatible client) and through a web dashboard. Users log meals, snacks, and single ingredients by describing them or photographing them; the AI estimates macros/micros and writes them to CalTrack via MCP tools. Users can save a dish once and recall it by name later. The system also computes and adaptively maintains a personalized daily calorie and macro target based on the user's stats and goals.

Ships as a single open-source codebase, runnable either self-hosted (Docker Compose, single user or small group) or as a hosted multi-tenant service.

---

## 2. Core User Flows

### 2.1 Logging (default — nothing is saved as a template)
User describes or photographs food ("100g 20% beef mince, 50g potatoes cooked in a tbsp of ghee," or a photo of a plate, or "black coffee"). The AI:
1. Identifies each component.
2. Resolves nutrition via the fallback chain: barcode lookup → web search for branded/restaurant nutrition → known per-ingredient values / nutrition-database lookup → estimate.
3. Asks for portion size if not given — never silently guesses on an ambiguous quantity.
4. Calls `log_food_entry` with a structured ingredient list. This is a **one-off entry**, regardless of complexity or whether it came from a photo. It is never added to Saved Meals unless the user explicitly asks.

### 2.2 Saved meals ("create a meal")
Only triggered by explicit intent: "create a meal called X," "save this as X," "remember my Y."
- The AI builds the ingredient list (from the current conversation or a fresh description/photo) and calls `create_saved_meal`.
- Later, "add my signature milkshake" → `search_saved_meals` finds it by fuzzy name → `log_saved_meal` copies its stored macros (ingredient-by-ingredient) into a new `food_entries` row, scaled by an optional quantity multiplier ("two servings of my signature milkshake").
- No re-estimation happens on recall — the whole point is consistency.
- Saved meals are editable (`update_saved_meal`) and deletable, both via chat and dashboard.

### 2.3 Profile & goals setup
User provides (via chat or dashboard): height, age, biological sex, activity level, goal type (lose weight / maintain / gain weight / gain muscle), goal weight, desired weekly rate of change. Current weight is read from the weight log, not stored separately.

Setting/changing these triggers a **deterministic server-side calculation** (not free-form LLM arithmetic) of a daily calorie target and a protein/carb/fat split, written back into `goals`.

### 2.4 Adaptive recalibration
Weekly, automatic: the backend compares actual weight trend against what the logged calorie balance predicted, and adjusts the daily target to keep the user on their chosen weekly rate. **Applies automatically**; every change is written to an audit log the dashboard displays, so nothing changes invisibly even though it doesn't require a confirmation step.

---

## 3. Data Model

| Table | Key fields |
|---|---|
| `users` | id, email, auth info |
| `profile` | user_id, height, height_unit, age, sex, activity_level, weight_unit, timezone |
| `weight_logs` | id, user_id, weight, logged_at *(current weight = latest row)* |
| `water_logs` | id, user_id, ml, logged_at |
| `goals` | user_id, goal_type, goal_weight, weekly_rate, daily_calories, protein_g, carb_g, fat_g, calories_locked (bool), macros_locked (bool), last_recalculated_at |
| `goal_adjustments_log` | id, user_id, date, old_calories, new_calories, old_macros, new_macros, basis (data used: avg weight Δ, avg logged intake, implied TDEE) |
| `food_entries` | id, user_id, description, meal_type, logged_at, source (text / image / barcode / saved_meal), saved_meal_id (nullable), calories, protein_g, carb_g, fat_g, fiber_g, sugar_g *(aggregate = sum of children)*, photo_url (nullable) |
| `food_entry_ingredients` | id, entry_id, name, quantity, unit, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g |
| `saved_meals` | id, user_id, name, description, created_from (text/image), calories, protein_g, carb_g, fat_g, fiber_g, sugar_g *(aggregate)* |
| `saved_meal_ingredients` | id, saved_meal_id, name, quantity, unit, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g |

Aggregates on `food_entries` / `saved_meals` are **server-computed** by summing their ingredient rows, not passed independently — guarantees totals always match the breakdown.

---

## 4. MCP Tool Specification

**Logging**
- `log_food_entry(description, meal_type, ingredients[], logged_at?, idempotency_key?)` — ingredients: `{name, quantity, unit, calories, protein_g, carb_g, fat_g, fiber_g, sugar_g}[]`
- `update_food_entry(id, ingredients?[], meal_type?, logged_at?)`
- `delete_food_entry(id)`
- `get_meals_today` / `get_meals_by_date` / `get_meals_by_date_range`
- `search_meals(queries[], days?, limit?)` — past one-off entries, for "what did I log like this before"

**Saved meals**
- `create_saved_meal(name, ingredients[], description?)` — or `create_saved_meal(name, from_entry_id)` to save something just logged
- `log_saved_meal(name_or_id, meal_type, quantity?, logged_at?)`
- `update_saved_meal(id, ...)` / `delete_saved_meal(id)`
- `search_saved_meals(query)` / `list_saved_meals()`

**Profile & goals**
- `set_profile(height, height_unit, age, sex, activity_level, weight_unit, timezone)`
- `set_goals(goal_type, goal_weight, weekly_rate)` → triggers initial calculation
- `get_goals()` / `get_goal_progress(date?)`
- `get_goal_history()` — the adjustment audit log
- `set_calorie_override(value)` / `set_macro_override(protein_g, carb_g, fat_g)` — locks that value out of adaptive recalibration until unlocked
- `recalculate_targets()` — manual on-demand trigger, in addition to the weekly job

**Weight / water / trends**
- `log_weight(value, logged_at?)` / `get_weight_trends(days?)`
- `log_water(ml, logged_at?)` / `get_water_today`
- `get_nutrition_summary(start_date, end_date)` / `get_trends(days?)`

**Other**
- `lookup_barcode(barcode)`
- `set_timezone(timezone)` / `get_profile()`

---

## 5. Calorie & Macro Calculation

**BMR** (Mifflin-St Jeor):
- Male: `10×weight_kg + 6.25×height_cm − 5×age + 5`
- Female: `10×weight_kg + 6.25×height_cm − 5×age − 161`

**TDEE** = BMR × activity multiplier (sedentary 1.2 / light 1.375 / moderate 1.55 / active 1.725 / very active 1.9)

**Daily target** = TDEE + (weekly_rate_kg × 7700 ÷ 7), sign flipped for loss vs. gain.

**Safety floors** (hard limits, not suggestions):
- Weekly rate capped at ~1% of bodyweight/week regardless of what the user requests; the tool should say so and cap it rather than silently comply with something more aggressive.
- Daily calorie target never set below a safe minimum floor (e.g. ~1.2× BMR).

**Macro split** (goal-dependent defaults, all user-overridable):
| Goal | Protein (g/kg bodyweight) | Fat | Carbs |
|---|---|---|---|
| Lose weight | 2.0 | 25% of calories (floor 0.5 g/kg) | remainder |
| Maintain | 1.5 | 25% of calories (floor 0.5 g/kg) | remainder |
| Gain muscle | 2.0 | 25% of calories (floor 0.5 g/kg) | remainder |
| Gain weight (general) | 1.5 | 25% of calories (floor 0.5 g/kg) | remainder |

These are standard sports-nutrition estimates, not medical advice — the dashboard should say so plainly.

---

## 6. Adaptive Recalibration Algorithm

- **Cadence**: weekly, via a scheduled backend job (cron container in Docker Compose for self-host; `pg_cron` or equivalent for hosted) — not something triggered inside a chat session.
- **Method**: compare the smoothed actual weight trend (moving average of `weight_logs`, not raw day-to-day noise) against what was predicted from logged calorie balance. The gap implies the user's real TDEE differs from the formula's estimate; the daily target shifts to correct it.
- **Data requirements**: needs a minimum of ~4 weigh-ins and ~5 logged days that week, or it skips and extends the window rather than recalculating off sparse data.
- **Guardrails**: single adjustment capped at ±15%; never crosses the safety floors in §5.
- **Application**: applies automatically. Every change writes to `goal_adjustments_log` (old value, new value, the data that drove it) so the dashboard can show a transparent history — nothing changes invisibly even without a confirm step.
- **Override**: `set_calorie_override` / `set_macro_override` lets the user lock a value; the adaptive engine skips locked values until unlocked.

---

## 7. Dashboard (web)

- **Today / Log view**: entries by meal type, running totals vs. targets, manual add/edit (including per-ingredient editing).
- **Saved Meals library**: browse/search/edit/delete templates.
- **Profile & Goals**: the stats form (height, age, sex, activity level, goal type, goal weight, weekly rate); shows computed calorie/macro targets with an override toggle.
- **Trends**: weight trend, nutrition trend, adherence.
- **Target history**: the `goal_adjustments_log`, visualized as a timeline of target changes with the reasoning behind each.

---

## 8. Architecture

- **DB**: Postgres (Supabase recommended — bundles auth, storage for meal photos, and Postgres in one, works identically self-hosted or hosted).
- **MCP + REST server**: single service, TypeScript (`@modelcontextprotocol/sdk`), Streamable HTTP transport (required for remote use — stdio only works fully local).
- **Auth**: OAuth 2.1 with Dynamic Client Registration — required by ChatGPT's connector spec and by Claude's remote-connector flow; a bare API key won't satisfy either.
- **Dashboard**: Next.js + Recharts, hitting the same REST API.
- **Nutrition data**: USDA FoodData Central (free, ingredient-level) + Open Food Facts (free, barcode/branded).
- **Self-host**: Docker Compose — Postgres + combined backend/MCP/API service + dashboard + a lightweight cron container for weekly recalibration.
- **Hosted**: same codebase, multi-tenant, users connect via OAuth from Claude/ChatGPT settings directly.

---

## 9. Self-Hosting Distribution

The dashboard ships as one of the containers in the self-host bundle — self-hosters run their own copy of the same webpage against their own private database, and never touch caltrack.com. Same relationship as WordPress.com vs. WordPress.org: one codebase, deployed in two different places by two different sets of people.

- **Distribution**: GitHub repo + tagged Releases. The Compose file references pre-built images (published to GHCR on each release), so `docker compose pull` is the "download" — no build-from-source step required.
- **Repo contents**: `docker-compose.yml`, `.env.example` (every var documented inline), `Caddyfile.example` (automatic HTTPS reverse proxy), `LICENSE` (MIT — full parity, fully open source, no features withheld for self-hosters).
- **Two documented setup tiers**:
  - *Local-only* — Claude Desktop's local (stdio) connection, dashboard at `localhost`. No domain, HTTPS, or OAuth needed since nothing leaves the machine. ~5 minute setup.
  - *Remote* — required for ChatGPT (remote-only) or multi-device access. Needs a domain + HTTPS (Caddy, or a PaaS with automatic HTTPS) + the full OAuth flow below.
- **Self-host auth**: a lightweight OAuth 2.1 + Dynamic Client Registration (RFC 7591) library bolted directly onto the MCP route — not a full identity platform. Each self-hosted instance runs its own independent auth server; nothing shared or centralized across instances. (Keycloak/Zitadel documented as an optional swap-in for anyone wanting full multi-user identity management.)
- **Reliability features** (built in specifically because the maintainer won't be running every instance):
  - A "test my setup" health check verifying public HTTPS reachability, the OAuth discovery endpoint, and reverse-proxy header forwarding — surfaces the classic Host-header misconfiguration before someone tries connecting an AI client and gets a confusing failure.
  - Recalibration doesn't depend solely on the cron container firing — also checked lazily on the next relevant request, so a dead cron job doesn't silently freeze someone's target forever.
  - Optional, opt-in, clearly disclosed anonymous error reporting — the only way bugs in the self-host path reach the maintainer without personally running it.
- **The guide** (README/docs): prerequisites, quick start, HTTPS setup, connecting Claude/ChatGPT, using the dashboard, backups, updating, troubleshooting.

---

## 10. Hosted Account & Sign-In Flow

The dashboard (caltrack.com) and AI-client connection share one user table — not two systems that need to stay in sync.

- Whichever a user does first — sign up on the dashboard, or connect via Claude/ChatGPT — lands on the same account, because both paths lead to the same login page. The AI-triggered OAuth flow opens that same login/sign-up screen; it isn't a separate identity system.
- **First-time connection**: AI client redirects to CalTrack's OAuth authorize endpoint → user logs in or signs up → consent screen ("Claude wants to read/write your meals and goals") → approve once → CalTrack issues a token scoped to that account → every subsequent tool call carries that token, which is how requests resolve to the right user without re-prompting.
- One account supports multiple simultaneously connected AI clients (e.g. Claude and ChatGPT at once), each with its own independently issued and independently revocable token, manageable from an account-settings "connected apps" page.

---

## 11. Build Order

1. Postgres schema (all tables in §3) + REST API — gives a working dashboard first.
2. MCP server wrapping the same DB, starting with `log_food_entry` + `get_meals_today`; test locally in Claude Desktop (stdio) for fast iteration.
3. Saved meals tool set (`create_saved_meal`, `log_saved_meal`, search).
4. Profile/goals tools + the deterministic calorie/macro calculation.
5. OAuth 2.1 + remote deployment; verify the same server works unmodified as a ChatGPT Developer Mode connector.
6. Weekly recalibration cron job + `goal_adjustments_log` + dashboard history view.
7. Image-logging path last — no new server code, just prompting/tool-description work once the base loop is solid.
