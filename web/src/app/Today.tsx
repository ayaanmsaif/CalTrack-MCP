import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { AnimatedNumber, EASE } from "../components/ui";
import { Alert, Bookmark, Chat, ChevronDown, ChevronLeft, ChevronRight, Droplet, Plug } from "../components/icons";
import { Ring } from "../components/Ring";
import { useEntries, useGoals, useHasAnyEntries, useTimezone, useWater, type DayEntry } from "../lib/queries";
import { addDays, diffDays, formatDayLong, formatDayOfMonth, formatTime, formatWeekday, listDays, weekStartKey } from "../lib/dates";
import { fmtInt, sumMacros } from "../lib/format";
import type { Goals } from "../lib/types";
import {
  Card,
  Collapse,
  EmptyState,
  IngredientTable,
  MacroGrams,
  MacroLegend,
  MacroMeter,
  MacroSplit,
  MEAL_TYPES,
  PageHeader,
  PromptChip,
  Skeleton,
  TimezoneNotice,
  useTodayKey,
} from "./components";

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function eyebrowFor(selected: string, today: string) {
  const d = diffDays(selected, today);
  if (d === 0) return "Today";
  if (d === -1) return "Yesterday";
  return `${-d} days ago`;
}

export function Today() {
  const { tz, ready, unset } = useTimezone();
  const today = useTodayKey(tz);
  const [params, setParams] = useSearchParams();
  const raw = params.get("d");
  const selected = raw && KEY_RE.test(raw) && raw <= today ? raw : today;
  const isToday = selected === today;

  const setSelected = (key: string) => {
    if (key > today) return;
    setParams(key === today ? {} : { d: key }, { replace: true });
  };

  const weekStart = weekStartKey(selected);
  const weekEnd = addDays(weekStart, 6);
  const entriesQ = useEntries(weekStart, weekEnd, tz, ready, isToday ? 60_000 : undefined);
  const waterQ = useWater(weekStart, weekEnd, tz, ready);
  const goalsQ = useGoals();
  const hasAnyQ = useHasAnyEntries();

  const entries = useMemo(() => entriesQ.data ?? [], [entriesQ.data]);
  const dayEntries = useMemo(() => entries.filter((e) => e.dayKey === selected), [entries, selected]);
  const totals = useMemo(() => sumMacros(dayEntries), [dayEntries]);
  const water = (waterQ.data ?? []).filter((w) => w.dayKey === selected).reduce((s, w) => s + w.ml, 0);
  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.dayKey, (m.get(e.dayKey) ?? 0) + e.calories);
    return m;
  }, [entries]);

  const goals = goalsQ.data ?? null;
  const target = goals?.daily_calories ?? null;
  const firstLoad = !ready || entriesQ.isPending || goalsQ.isPending;
  const refreshing = entriesQ.isPlaceholderData;

  const prev = useRef(selected);
  const direction = selected > prev.current ? 1 : selected < prev.current ? -1 : 0;
  useEffect(() => {
    prev.current = selected;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, [role=group]")) return;
      if (e.key === "ArrowLeft") setSelected(addDays(selected, -1));
      if (e.key === "ArrowRight" && !isToday) setSelected(addDays(selected, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={eyebrowFor(selected, today)}
        title={formatDayLong(selected)}
        right={
          <>
            {!isToday && (
              <button
                onClick={() => setSelected(today)}
                className="h-10 rounded-full bg-white px-4 text-[14px] font-medium text-ink ring-1 ring-line transition-shadow hover:ring-ink/20"
              >
                Today
              </button>
            )}
            <div className="flex rounded-full bg-white p-1 ring-1 ring-line">
              <button
                onClick={() => setSelected(addDays(selected, -1))}
                aria-label="Previous day"
                className="grid size-8 place-items-center rounded-full text-ink-2 transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setSelected(addDays(selected, 1))}
                disabled={isToday}
                aria-label="Next day"
                className="grid size-8 place-items-center rounded-full text-ink-2 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </>
        }
      />

      {unset && ready && <TimezoneNotice />}

      <WeekStrip weekStart={weekStart} selected={selected} today={today} perDay={perDay} target={target} onSelect={setSelected} />

      <div className={`grid gap-4 transition-opacity duration-300 lg:grid-cols-[1.12fr_1fr] ${refreshing ? "opacity-60" : ""}`}>
        <CaloriesCard eaten={totals.calories} target={target} count={dayEntries.length} loading={firstLoad} isToday={isToday} />
        <MacrosCard totals={totals} goals={goals} water={water} loading={firstLoad} />
      </div>

      <Card className={`p-2 transition-opacity duration-300 md:p-3 ${refreshing ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-1 pt-3">
          <h2 className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">Meals</h2>
          {dayEntries.length > 0 && <MacroLegend />}
        </div>

        {firstLoad ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <motion.div key={selected} initial={{ opacity: 0, x: direction * 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }}>
            {dayEntries.length === 0 ? (
              <EmptyState
                icon={Chat}
                title={isToday ? "Nothing logged yet today" : "Nothing logged this day"}
                body={
                  hasAnyQ.data === false
                    ? "Once CalTrack is connected to your AI, tell it what you ate and it'll show up here."
                    : "Tell your AI what you ate and it'll show up here within a minute."
                }
              >
                {hasAnyQ.data === false ? (
                  <Link
                    to="/app/connect"
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-medium text-white transition-colors hover:bg-leaf-800"
                  >
                    <Plug size={16} />
                    Connect your AI
                  </Link>
                ) : (
                  <PromptChip text="I had porridge with a banana for breakfast" />
                )}
              </EmptyState>
            ) : (
              MEAL_TYPES.map(({ type, label }) => {
                const items = dayEntries.filter((e) => e.meal_type === type);
                return items.length ? <MealGroup key={type} label={label} items={items} tz={tz} /> : null;
              })
            )}
          </motion.div>
        )}
      </Card>
    </div>
  );
}

function WeekStrip({
  weekStart,
  selected,
  today,
  perDay,
  target,
  onSelect,
}: {
  weekStart: string;
  selected: string;
  today: string;
  perDay: Map<string, number>;
  target: number | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1 rounded-[22px] bg-white p-1.5 ring-1 ring-line">
      {listDays(weekStart, 7).map((key) => {
        const future = key > today;
        const isSel = key === selected;
        const kcal = perDay.get(key) ?? 0;
        return (
          <button
            key={key}
            disabled={future}
            onClick={() => onSelect(key)}
            aria-pressed={isSel}
            aria-label={`${formatDayLong(key)}${kcal ? `, ${fmtInt(kcal)} kcal` : ""}`}
            className="relative flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors duration-200 hover:bg-ink/[0.025] disabled:pointer-events-none disabled:opacity-35"
          >
            {isSel && (
              <motion.span
                layoutId="week-selected"
                className="absolute inset-0 rounded-2xl bg-leaf-50 ring-1 ring-leaf-200"
                transition={{ type: "spring", stiffness: 450, damping: 38 }}
              />
            )}
            <span className="relative text-[11.5px] text-ink-3">{formatWeekday(key)}</span>
            <span className={`relative text-[15px] font-medium tnum ${key === today ? "text-leaf-700" : "text-ink"}`}>{formatDayOfMonth(key)}</span>
            <span className="relative grid size-[26px] place-items-center">
              {target ? (
                <Ring size={26} stroke={3.5} ratio={kcal / target} surface={isSel ? "var(--color-leaf-50)" : "#ffffff"} />
              ) : (
                <span className={`size-2 rounded-full ${kcal > 0 ? "bg-leaf-500" : "bg-ink/10"}`} />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CaloriesCard({
  eaten,
  target,
  count,
  loading,
  isToday,
}: {
  eaten: number;
  target: number | null;
  count: number;
  loading: boolean;
  isToday: boolean;
}) {
  const remaining = target != null ? target - eaten : null;
  const over = remaining != null && remaining < 0;

  return (
    <Card className="flex flex-col items-center gap-7 p-6 sm:flex-row sm:items-center md:p-8">
      <Ring size={204} stroke={16} ratio={loading || !target ? 0 : eaten / target}>
        {loading ? (
          <Skeleton className="h-12 w-24" />
        ) : remaining != null ? (
          <>
            <span className="text-[13px] text-ink-3">{over ? "Over by" : isToday ? "Left today" : "Left"}</span>
            <span className="mt-1 text-[48px] font-semibold leading-none tracking-[-0.035em] text-ink">
              <AnimatedNumber value={Math.abs(remaining)} />
            </span>
            <span className="mt-1.5 text-[13px] text-ink-3">kcal</span>
          </>
        ) : (
          <>
            <span className="text-[48px] font-semibold leading-none tracking-[-0.035em] text-ink">
              <AnimatedNumber value={eaten} />
            </span>
            <span className="mt-1.5 text-[13px] text-ink-3">kcal eaten</span>
          </>
        )}
      </Ring>

      <div className="w-full flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-paper px-4 py-3">
            <div className="text-[12.5px] text-ink-3">Eaten</div>
            <div className="mt-0.5 text-[20px] font-semibold text-ink">
              {loading ? "–" : <AnimatedNumber value={eaten} />}
              <span className="ml-1 text-[12.5px] font-normal text-ink-3">kcal</span>
            </div>
          </div>
          <div className="rounded-2xl bg-paper px-4 py-3">
            <div className="text-[12.5px] text-ink-3">Target</div>
            <div className="mt-0.5 text-[20px] font-semibold text-ink">
              {target != null ? (
                <>
                  {fmtInt(target)}
                  <span className="ml-1 text-[12.5px] font-normal text-ink-3">kcal</span>
                </>
              ) : (
                <span className="text-[15px] font-medium text-ink-2">Not set</span>
              )}
            </div>
          </div>
        </div>

        {over && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-[#fdf0ea] px-4 py-3 text-[13.5px] text-ink">
            <Alert size={16} className="shrink-0 text-serious" />
            {fmtInt(-remaining!)} kcal over {isToday ? "today's" : "the"} target
          </div>
        )}

        {!loading && target == null && (
          <Link
            to="/app/goals"
            className="block rounded-2xl bg-leaf-50 px-4 py-3 text-[13.5px] leading-relaxed text-ink-2 ring-1 ring-leaf-100 transition-colors hover:bg-leaf-100/60"
          >
            No daily target yet. Tell your AI your height, weight, age and goal to get one.
          </Link>
        )}

        <div className="px-1 text-[13px] text-ink-3">
          {count} {count === 1 ? "entry" : "entries"} logged
        </div>
      </div>
    </Card>
  );
}

function MacrosCard({
  totals,
  goals,
  water,
  loading,
}: {
  totals: ReturnType<typeof sumMacros>;
  goals: Goals | null;
  water: number;
  loading: boolean;
}) {
  return (
    <Card className="flex flex-col p-6 md:p-7">
      <h2 className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">Macros</h2>
      {loading ? (
        <div className="mt-5 space-y-5">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <MacroMeter label="Protein" color="var(--color-protein)" value={totals.protein_g} target={goals?.protein_g ?? null} />
          <MacroMeter label="Carbs" color="var(--color-carbs)" value={totals.carb_g} target={goals?.carb_g ?? null} />
          <MacroMeter label="Fat" color="var(--color-fat)" value={totals.fat_g} target={goals?.fat_g ?? null} />
        </div>
      )}
      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line-soft pt-4 text-[13px]">
        <div>
          <div className="text-ink-3">Fiber</div>
          <div className="mt-0.5 font-medium text-ink tnum">{fmtInt(totals.fiber_g)} g</div>
        </div>
        <div>
          <div className="text-ink-3">Sugar</div>
          <div className="mt-0.5 font-medium text-ink tnum">{fmtInt(totals.sugar_g)} g</div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-ink-3">
            <Droplet size={13} />
            Water
          </div>
          <div className="mt-0.5 font-medium text-ink tnum">{fmtInt(water)} ml</div>
        </div>
      </div>
    </Card>
  );
}

function MealGroup({ label, items, tz }: { label: string; items: DayEntry[]; tz: string }) {
  const total = items.reduce((s, e) => s + e.calories, 0);
  return (
    <div className="px-1 py-1.5">
      <div className="flex items-baseline justify-between px-3 pb-1 pt-2">
        <span className="text-[12px] font-medium uppercase tracking-[0.09em] text-ink-3">{label}</span>
        <span className="text-[13px] text-ink-3 tnum">{fmtInt(total)} kcal</span>
      </div>
      <ul className="space-y-0.5">
        {items.map((e) => (
          <EntryRow key={e.id} entry={e} tz={tz} />
        ))}
      </ul>
    </div>
  );
}

const SOURCE_LABEL: Partial<Record<DayEntry["source"], string>> = {
  saved_meal: "Saved meal",
  barcode: "Barcode",
  image_estimated: "Photo",
};

function EntryRow({ entry, tz }: { entry: DayEntry; tz: string }) {
  const [open, setOpen] = useState(false);
  const source = SOURCE_LABEL[entry.source];

  return (
    <li className={`rounded-2xl transition-colors duration-300 ${open ? "bg-paper" : "hover:bg-paper/70"}`}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className="hidden w-[3.75rem] shrink-0 text-[12.5px] text-ink-3 tnum sm:block">{formatTime(entry.logged_at, tz)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] text-ink">{entry.description}</span>
            {source && (
              <span className="hidden shrink-0 items-center gap-1 rounded-full bg-leaf-50 px-2 py-0.5 text-[11.5px] text-leaf-700 ring-1 ring-leaf-100 sm:inline-flex">
                {entry.source === "saved_meal" && <Bookmark size={11} />}
                {source}
              </span>
            )}
          </span>
          <span className="mt-2 flex items-center gap-3">
            <span className="text-[12px] text-ink-3 tnum sm:hidden">{formatTime(entry.logged_at, tz)}</span>
            <MacroSplit macros={entry} />
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[15px] font-medium text-ink tnum">{fmtInt(entry.calories)}</span>
          <span className="block text-[11.5px] text-ink-3">kcal</span>
        </span>
        <ChevronDown size={17} className={`shrink-0 text-ink-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <Collapse open={open}>
        <div className="px-3 pb-3 sm:pl-[5.25rem]">
          <MacroGrams macros={entry} className="mb-1" />
          <IngredientTable items={entry.food_entry_ingredients} />
        </div>
      </Collapse>
    </li>
  );
}
