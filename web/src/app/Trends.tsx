import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "../components/ui";
import { Chat, Scale } from "../components/icons";
import { useEntries, useGoals, useProfile, useTimezone, useWeights } from "../lib/queries";
import { addDays, dayKeyInZone, formatDayLong, formatDayShort, formatWeekday, keyToUtcDate, listDays } from "../lib/dates";
import { displayWeight, fmt1, fmtInt, sumMacros } from "../lib/format";
import { Card, CardHeader, EmptyState, MACROS, PageHeader, PromptChip, Segmented, StatTile, useTodayKey } from "./components";
import { ColumnChart, LineChart, type ColumnDatum } from "./charts";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

type View = "chart" | "table";

export function Trends() {
  const { tz, ready } = useTimezone();
  const today = useTodayKey(tz);
  const [params, setParams] = useSearchParams();
  const rangeParam = params.get("range") ?? "30";
  const range = RANGES.some((r) => r.value === rangeParam) ? Number(rangeParam) : 30;
  const start = addDays(today, -(range - 1));
  const days = useMemo(() => listDays(start, range), [start, range]);

  const entriesQ = useEntries(start, today, tz, ready);
  const goalsQ = useGoals();
  const profileQ = useProfile();
  const weightsQ = useWeights(keyToUtcDate(addDays(start, -1)).toISOString());

  const unit = profileQ.data?.weight_unit ?? "kg";
  const goals = goalsQ.data ?? null;
  const target = goals?.daily_calories ?? null;

  const byDay = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof entriesQ.data>>();
    for (const e of entriesQ.data ?? []) {
      const list = groups.get(e.dayKey) ?? [];
      list.push(e);
      groups.set(e.dayKey, list);
    }
    return new Map([...groups].map(([k, v]) => [k, sumMacros(v)]));
  }, [entriesQ.data]);

  const logged = days.filter((d) => byDay.has(d));
  const avg = (k: "calories" | "protein_g" | "carb_g" | "fat_g") =>
    logged.length ? logged.reduce((s, d) => s + byDay.get(d)![k], 0) / logged.length : 0;

  const weights = useMemo(
    () => (weightsQ.data ?? []).filter((w) => dayKeyInZone(new Date(w.logged_at), tz) >= start),
    [weightsQ.data, tz, start]
  );
  const firstW = weights[0];
  const lastW = weights[weights.length - 1];
  const delta = weights.length >= 2 ? displayWeight(lastW.weight_kg, unit) - displayWeight(firstW.weight_kg, unit) : null;
  const deltaGood =
    delta == null
      ? false
      : goals?.goal_type === "lose_weight"
        ? delta < 0
        : goals?.goal_type === "gain_weight" || goals?.goal_type === "gain_muscle"
          ? delta > 0
          : false;

  const within = target ? logged.filter((d) => Math.abs(byDay.get(d)!.calories - target) <= target * 0.1).length : null;

  const columns: ColumnDatum[] = days.map((key) => {
    const t = byDay.get(key);
    return {
      key,
      label: formatDayLong(key),
      short: range <= 7 ? formatWeekday(key) : formatDayShort(key),
      value: t ? t.calories : null,
      protein: t?.protein_g ?? 0,
      carbs: t?.carb_g ?? 0,
      fat: t?.fat_g ?? 0,
    };
  });

  const [calView, setCalView] = useState<View>("chart");
  const [weightView, setWeightView] = useState<View>("chart");
  const refreshing = entriesQ.isPlaceholderData || weightsQ.isPlaceholderData;
  const loading = !ready || entriesQ.isPending;

  const domain: [number, number] = [keyToUtcDate(start).getTime(), keyToUtcDate(today).getTime() + 86_400_000];
  const axisCount = range <= 7 ? 7 : 4;
  const axis = Array.from({ length: axisCount }, (_, i) => {
    const key = addDays(start, Math.round((i / Math.max(axisCount - 1, 1)) * (range - 1)));
    return { t: keyToUtcDate(key).getTime() + 43_200_000, label: range <= 7 ? formatWeekday(key) : formatDayShort(key) };
  });

  const macroAvg = { protein_g: avg("protein_g"), carb_g: avg("carb_g"), fat_g: avg("fat_g") };
  const macroKcal = MACROS.map((m) => ({ ...m, grams: macroAvg[m.key], kcal: macroAvg[m.key] * m.kcalPerGram }));
  const macroTotal = macroKcal.reduce((s, m) => s + m.kcal, 0);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Trends" title={`The last ${range} days`} />

      <Segmented id="range" label="Date range" value={String(range)} onChange={(v) => setParams({ range: v }, { replace: true })} options={RANGES} />

      <div className={`space-y-4 transition-opacity duration-300 ${refreshing ? "opacity-60" : ""}`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Average calories"
            value={logged.length ? fmtInt(avg("calories")) : "–"}
            sub={target ? `Target ${fmtInt(target)}` : "Per logged day"}
          />
          <StatTile
            label="Average protein"
            value={logged.length ? `${fmtInt(avg("protein_g"))} g` : "–"}
            sub={goals?.protein_g ? `Target ${fmtInt(goals.protein_g)} g` : "Per logged day"}
          />
          <StatTile label="Days logged" value={loading ? "–" : logged.length} sub={`Out of ${range}`} />
          <StatTile
            label="Weight change"
            value={delta == null ? "–" : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${fmt1(Math.abs(delta))} ${unit}`}
            sub={lastW ? `Latest ${fmt1(displayWeight(lastW.weight_kg, unit))} ${unit}` : "No weigh-ins yet"}
            subTone={deltaGood ? "good" : "muted"}
          />
        </div>

        <Card className="p-5 md:p-6">
          <CardHeader
            title="Calories per day"
            sub={within != null && logged.length ? `${within} of ${logged.length} logged days within 10% of target` : undefined}
            right={
              logged.length > 0 && (
                <Segmented
                  id="cal-view"
                  label="Calories view"
                  value={calView}
                  onChange={setCalView}
                  options={[
                    { value: "chart", label: "Chart" },
                    { value: "table", label: "Table" },
                  ]}
                />
              )
            }
          />
          {!loading && logged.length === 0 ? (
            <EmptyState icon={Chat} title="Nothing logged in this range" body="Meals you log through your AI will build up here day by day.">
              <PromptChip text="I had a chicken salad for lunch" />
            </EmptyState>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={calView} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: EASE }}>
                {calView === "chart" ? (
                  <ColumnChart data={columns} target={target} />
                ) : (
                  <div className="mt-4 max-h-[340px] overflow-auto">
                    <table className="w-full text-[13.5px]">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-[12px] text-ink-3">
                          <th className="py-2 pr-3 font-normal">Date</th>
                          <th className="px-3 text-right font-normal">kcal</th>
                          <th className="px-3 text-right font-normal">Protein</th>
                          <th className="px-3 text-right font-normal">Carbs</th>
                          <th className="pl-3 text-right font-normal">Fat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...columns].reverse().map((c) => (
                          <tr key={c.key} className="border-t border-line-soft">
                            <td className="py-2 pr-3 text-ink">{c.label}</td>
                            <td className="px-3 text-right text-ink tnum">{c.value ? fmtInt(c.value) : "–"}</td>
                            <td className="px-3 text-right text-ink-2 tnum">{c.value ? `${fmt1(c.protein)} g` : "–"}</td>
                            <td className="px-3 text-right text-ink-2 tnum">{c.value ? `${fmt1(c.carbs)} g` : "–"}</td>
                            <td className="pl-3 text-right text-ink-2 tnum">{c.value ? `${fmt1(c.fat)} g` : "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
          <Card className="p-5 md:p-6">
            <CardHeader
              title={`Weight (${unit})`}
              sub={delta != null ? `${delta > 0 ? "Up" : delta < 0 ? "Down" : "No change,"} ${fmt1(Math.abs(delta))} ${unit} over ${weights.length} weigh-ins` : undefined}
              right={
                weights.length >= 2 && (
                  <Segmented
                    id="weight-view"
                    label="Weight view"
                    value={weightView}
                    onChange={setWeightView}
                    options={[
                      { value: "chart", label: "Chart" },
                      { value: "table", label: "Table" },
                    ]}
                  />
                )
              }
            />
            {weights.length < 2 ? (
              <EmptyState
                icon={Scale}
                title={weights.length === 1 ? "One weigh-in so far" : "No weigh-ins in this range"}
                body="Log your weight a couple of times and the trend line appears here."
              >
                <PromptChip text="Weighed in at 80.2 kg this morning" />
              </EmptyState>
            ) : weightView === "chart" ? (
              <LineChart
                points={weights.map((w) => ({
                  t: new Date(w.logged_at).getTime(),
                  v: displayWeight(w.weight_kg, unit),
                  label: formatDayLong(dayKeyInZone(new Date(w.logged_at), tz)),
                }))}
                domain={domain}
                axis={axis}
                unit={unit}
              />
            ) : (
              <div className="mt-4 max-h-[260px] overflow-auto">
                <table className="w-full text-[13.5px]">
                  <tbody>
                    {[...weights].reverse().map((w) => (
                      <tr key={w.id} className="border-t border-line-soft first:border-t-0">
                        <td className="py-2 pr-3 text-ink">{formatDayLong(dayKeyInZone(new Date(w.logged_at), tz))}</td>
                        <td className="pl-3 text-right text-ink tnum">
                          {fmt1(displayWeight(w.weight_kg, unit))} {unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5 md:p-6">
            <CardHeader title="Where calories came from" sub={logged.length ? "Daily average across logged days" : undefined} />
            {macroTotal > 0 ? (
              <>
                <div className="mt-6 flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
                  {macroKcal.map((m) => (
                    <motion.span
                      key={m.key}
                      className="h-full"
                      style={{ background: m.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(m.kcal / macroTotal) * 100}%` }}
                      transition={{ duration: 0.8, ease: EASE }}
                    />
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {macroKcal.map((m) => (
                    <div key={m.key} className="flex items-center gap-3 text-[14px]">
                      <span className="h-2.5 w-3 shrink-0 rounded-[3px]" style={{ background: m.color }} />
                      <span className="flex-1 text-ink">{m.label}</span>
                      <span className="text-ink-2 tnum">{fmtInt(m.grams)} g</span>
                      <span className="w-12 text-right font-medium text-ink tnum">{Math.round((m.kcal / macroTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-6 text-[14px] text-ink-3">Log a few meals to see your macro split.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
