import { Info, Lock, Target } from "../components/icons";
import { useGoalHistory, useGoals, useLatestWeight, useProfile } from "../lib/queries";
import { displayWeight, fmt1, fmtInt } from "../lib/format";
import type { Profile } from "../lib/types";
import { Card, CardHeader, EmptyState, MACROS, PageHeader, PromptChip, Row, Skeleton } from "./components";
import { AccountData } from "./AccountData";

const GOAL_LABEL = {
  lose_weight: "Lose weight",
  maintain: "Maintain weight",
  gain_weight: "Gain weight",
  gain_muscle: "Build muscle",
} as const;

const ACTIVITY_LABEL = {
  sedentary: "Sedentary",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Active",
  very_active: "Very active",
} as const;

function formatHeight(profile: Profile) {
  if (profile.height_cm == null) return "Not set";
  if (profile.height_unit === "in") {
    const totalIn = profile.height_cm / 2.54;
    const ft = Math.floor(totalIn / 12);
    const inches = Math.round(totalIn - ft * 12);
    return `${ft}′ ${inches}″`;
  }
  return `${Math.round(profile.height_cm)} cm`;
}

function LockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[11.5px] font-medium text-ink-2 ring-1 ring-line">
      <Lock size={11} />
      Set manually
    </span>
  );
}

export function Goals() {
  const goalsQ = useGoals();
  const profileQ = useProfile();
  const weightQ = useLatestWeight();
  const historyQ = useGoalHistory();

  const goals = goalsQ.data ?? null;
  const profile = profileQ.data ?? null;
  const unit = profile?.weight_unit ?? "kg";
  const latest = weightQ.data ?? null;

  if (goalsQ.isPending || profileQ.isPending) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Goals" title="Targets & profile" />
        <Skeleton className="h-48 rounded-[24px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-[24px]" />
          <Skeleton className="h-64 rounded-[24px]" />
        </div>
      </div>
    );
  }

  if (!goals && !profile) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Goals" title="Targets & profile" />
        <Card>
          <EmptyState
            icon={Target}
            title="No targets yet"
            body="Tell your AI a bit about yourself and what you're aiming for. It works out a daily calorie and macro target from that."
          >
            <PromptChip text="I'm 30, 178 cm, moderately active, male" />
            <PromptChip text="I weigh 82 kg and want to lose half a kilo a week" />
          </EmptyState>
        </Card>
      </div>
    );
  }

  const macroTargets = MACROS.map((m) => ({ ...m, grams: goals?.[m.key] ?? null }));
  const macroKcal = macroTargets.reduce((s, m) => s + (m.grams ?? 0) * m.kcalPerGram, 0);
  const currentDisplay = latest ? displayWeight(latest.weight_kg, unit) : null;
  const goalDisplay = goals?.goal_weight_kg != null ? displayWeight(goals.goal_weight_kg, unit) : null;
  const toGo = currentDisplay != null && goalDisplay != null ? goalDisplay - currentDisplay : null;
  const rate = goals ? displayWeight(Math.abs(goals.weekly_rate_kg), unit) : 0;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Goals" title="Targets & profile" />

      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">Daily targets</h2>
          {goals?.calories_locked && <LockBadge />}
        </div>
        {goals?.daily_calories != null ? (
          <div className="mt-5 grid gap-8 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
            <div>
              <div className="text-[52px] font-semibold leading-none tracking-[-0.035em] text-ink">{fmtInt(goals.daily_calories)}</div>
              <div className="mt-2 text-[14px] text-ink-3">kcal per day</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {macroTargets.map((m) => (
                <div key={m.key} className="rounded-2xl bg-paper px-4 py-3.5">
                  <div className="flex items-center gap-2 text-[13px] text-ink-2">
                    <span className="size-2 rounded-full" style={{ background: m.color }} />
                    {m.label}
                  </div>
                  <div className="mt-1 text-[22px] font-semibold text-ink">
                    {m.grams != null ? fmtInt(m.grams) : "–"}
                    <span className="ml-1 text-[13px] font-normal text-ink-3">g</span>
                  </div>
                  {m.grams != null && macroKcal > 0 && (
                    <div className="text-[12px] text-ink-3">{Math.round(((m.grams * m.kcalPerGram) / macroKcal) * 100)}% of calories</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-[14.5px] text-ink-2">
            Your targets will appear once your profile and a recent weigh-in are in. Ask your AI to recalculate once they are.
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-4 text-[12.5px] text-ink-3">
          <span>{goals?.macros_locked ? "Macro targets set manually." : "Protein and fat scale with your bodyweight; carbs fill the rest."}</span>
          {goals?.last_recalculated_at && <span>Last calculated {new Date(goals.last_recalculated_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 md:p-6">
          <CardHeader title="Your goal" />
          <div className="mt-2">
            <Row label="Goal" value={goals ? GOAL_LABEL[goals.goal_type] : "Not set"} />
            <Row label="Target weight" value={goalDisplay != null ? `${fmt1(goalDisplay)} ${unit}` : "Not set"} />
            <Row
              label="Weekly pace"
              value={
                !goals
                  ? "Not set"
                  : goals.weekly_rate_kg === 0
                    ? "Hold steady"
                    : `${goals.weekly_rate_kg < 0 ? "Lose" : "Gain"} ${fmt1(rate)} ${unit} / week`
              }
            />
            <Row label="Current weight" value={currentDisplay != null ? `${fmt1(currentDisplay)} ${unit}` : "No weigh-ins yet"} />
            {toGo != null && (
              <Row label="To go" value={Math.abs(toGo) < 0.05 ? "You're there" : `${fmt1(Math.abs(toGo))} ${unit} to ${toGo < 0 ? "lose" : "gain"}`} />
            )}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <CardHeader title="Profile" />
          <div className="mt-2">
            <Row label="Age" value={profile?.age != null ? profile.age : "Not set"} />
            <Row label="Sex" value={profile?.sex ? (profile.sex === "male" ? "Male" : "Female") : "Not set"} />
            <Row label="Height" value={profile ? formatHeight(profile) : "Not set"} />
            <Row label="Activity" value={profile?.activity_level ? ACTIVITY_LABEL[profile.activity_level] : "Not set"} />
            <Row label="Timezone" value={profile?.timezone ?? "UTC"} />
            <Row label="Units" value={profile ? `${profile.weight_unit}, ${profile.height_unit}` : "kg, cm"} />
          </div>
        </Card>
      </div>

      <Card className="p-5 md:p-6">
        <CardHeader title="Target history" sub="Every change to your targets, with the numbers behind it" />
        {historyQ.data && historyQ.data.length > 0 ? (
          <ol className="mt-4 space-y-0">
            {historyQ.data.map((h) => (
              <li key={h.id} className="relative border-l border-line pb-5 pl-5 last:pb-0">
                <span className="absolute -left-[5px] top-1.5 size-[9px] rounded-full bg-leaf-500 ring-2 ring-white" />
                <div className="text-[12.5px] text-ink-3">{new Date(h.adjusted_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</div>
                <div className="mt-0.5 text-[15px] font-medium text-ink tnum">
                  {h.old_calories != null ? fmtInt(h.old_calories) : "–"} → {h.new_calories != null ? fmtInt(h.new_calories) : "–"} kcal
                </div>
                {h.basis && (
                  <div className="mt-1 text-[13px] text-ink-2">
                    {Object.entries(h.basis)
                      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "number" ? fmt1(v) : String(v)}`)
                      .join(" · ")}
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-[14px] text-ink-3">No adjustments yet.</p>
        )}
      </Card>

      <div className="flex items-start gap-3 rounded-2xl bg-white p-4 text-[13.5px] leading-relaxed text-ink-2 ring-1 ring-line">
        <Info size={17} className="mt-0.5 shrink-0 text-leaf-600" />
        <p>
          Targets are standard sports-nutrition estimates (Mifflin-St Jeor with an activity multiplier, weekly pace capped at about
          1% of bodyweight, never below 1.2× resting burn). They're not medical advice. To change anything here, just ask your AI.
        </p>
      </div>

      <AccountData />
    </div>
  );
}
