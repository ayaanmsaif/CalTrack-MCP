import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AnimatedNumber, EASE, useCopy } from "../components/ui";
import { Check, Globe } from "../components/icons";
import { fmt1, fmtInt } from "../lib/format";
import { todayKey } from "../lib/dates";
import type { Ingredient, Macros, MealType } from "../lib/types";

export const MACROS = [
  { key: "protein_g", label: "Protein", color: "var(--color-protein)", kcalPerGram: 4 },
  { key: "carb_g", label: "Carbs", color: "var(--color-carbs)", kcalPerGram: 4 },
  { key: "fat_g", label: "Fat", color: "var(--color-fat)", kcalPerGram: 9 },
] as const;

export const MEAL_TYPES: { type: MealType; label: string }[] = [
  { type: "breakfast", label: "Breakfast" },
  { type: "lunch", label: "Lunch" },
  { type: "dinner", label: "Dinner" },
  { type: "snack", label: "Snacks" },
];

export function useTodayKey(tz: string) {
  const [key, setKey] = useState(() => todayKey(tz));
  useEffect(() => {
    setKey(todayKey(tz));
    const id = window.setInterval(() => setKey(todayKey(tz)), 60_000);
    return () => window.clearInterval(id);
  }, [tz]);
  return key;
}

export function PageHeader({ eyebrow, title, right }: { eyebrow?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <div className="text-[13.5px] text-ink-3">{eyebrow}</div>}
        <h1 className="mt-1 text-[27px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[32px]">{title}</h1>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-[24px] bg-white ring-1 ring-line ${className}`}>{children}</section>;
}

export function CardHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-[13.5px] text-ink-3">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-ink/[0.05] ${className}`} />;
}

export function MacroMeter({ label, color, value, target }: { label: string; color: string; value: number; target: number | null }) {
  const ratio = target ? Math.min(value / target, 1) : 0;
  const diff = target != null ? target - value : null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-[14.5px] text-ink">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="text-[13.5px] text-ink-3 tnum">
          <AnimatedNumber value={value} className="font-medium text-ink" />
          {target != null ? ` / ${fmtInt(target)} g` : " g"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, ${color} 16%, white)` }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ x: "-100%" }}
          animate={{ x: `${(ratio - 1) * 100}%` }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </div>
      {diff != null && (
        <div className="mt-1.5 text-[12.5px] text-ink-3 tnum">{diff >= 0 ? `${fmtInt(diff)} g left` : `${fmtInt(-diff)} g over`}</div>
      )}
    </div>
  );
}

// Share of calories from each macro, as a thin stacked bar with 2px surface gaps.
export function MacroSplit({ macros, className = "" }: { macros: Pick<Macros, "protein_g" | "carb_g" | "fat_g">; className?: string }) {
  const parts = MACROS.map((m) => ({ ...m, kcal: macros[m.key] * m.kcalPerGram }));
  const total = parts.reduce((s, p) => s + p.kcal, 0);
  if (total <= 0) return null;
  return (
    <div className={`flex h-1.5 w-full max-w-[220px] gap-[2px] overflow-hidden rounded-full ${className}`} aria-hidden="true">
      {parts.map((p) =>
        p.kcal > 0 ? <span key={p.key} className="h-full" style={{ width: `${(p.kcal / total) * 100}%`, background: p.color }} /> : null
      )}
    </div>
  );
}

export function MacroLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 text-[12.5px] text-ink-2 ${className}`}>
      {MACROS.map((m) => (
        <span key={m.key} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2.5 rounded-[2px]" style={{ background: m.color }} />
          {m.label}
        </span>
      ))}
    </div>
  );
}

export function MacroGrams({ macros, className = "" }: { macros: Pick<Macros, "protein_g" | "carb_g" | "fat_g">; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2 ${className}`}>
      {MACROS.map((m) => (
        <span key={m.key} className="inline-flex items-center gap-1.5 whitespace-nowrap tnum">
          <span className="size-1.5 rounded-full" style={{ background: m.color }} />
          {fmt1(macros[m.key])} g {m.label.toLowerCase()}
        </span>
      ))}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: ComponentType<{ size?: number }>;
  title: ReactNode;
  body: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-leaf-50 text-leaf-600 ring-1 ring-leaf-100">
        <Icon size={22} />
      </div>
      <h3 className="mt-4 text-[16px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-[27rem] text-[14.5px] leading-relaxed text-ink-2 text-pretty">{body}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function PromptChip({ text }: { text: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      onClick={() => copy(text)}
      className="group relative inline-flex items-center gap-2 rounded-full bg-paper px-3.5 py-2 text-left text-[14px] text-ink ring-1 ring-line transition-[box-shadow,background-color] duration-300 hover:bg-white hover:ring-leaf-300"
      title="Copy"
    >
      <span>“{text}”</span>
      <span className="grid w-4 place-items-center text-leaf-600">
        <AnimatePresence initial={false}>
          {copied && (
            <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
              <Check size={15} strokeWidth={2.4} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  );
}

export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration: 0.35, ease: EASE }, opacity: { duration: 0.22 } }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function IngredientTable({ items }: { items: Ingredient[] }) {
  if (items.length === 0) return <p className="py-2 text-[13.5px] text-ink-3">No ingredient breakdown.</p>;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[420px] text-[13.5px]">
        <thead>
          <tr className="text-left text-[12px] text-ink-3">
            <th className="py-2 pr-3 font-normal">Ingredient</th>
            <th className="px-3 font-normal">Amount</th>
            <th className="px-3 text-right font-normal">kcal</th>
            <th className="px-3 text-right font-normal">Protein</th>
            <th className="px-3 text-right font-normal">Carbs</th>
            <th className="pl-3 text-right font-normal">Fat</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-line-soft">
              <td className="py-2 pr-3 text-ink">{i.name}</td>
              <td className="whitespace-nowrap px-3 text-ink-2 tnum">
                {fmt1(i.quantity)}
                {i.unit ? ` ${i.unit}` : ""}
              </td>
              <td className="px-3 text-right text-ink tnum">{fmtInt(i.calories)}</td>
              <td className="px-3 text-right text-ink-2 tnum">{fmt1(i.protein_g)} g</td>
              <td className="px-3 text-right text-ink-2 tnum">{fmt1(i.carb_g)} g</td>
              <td className="pl-3 text-right text-ink-2 tnum">{fmt1(i.fat_g)} g</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Segmented<T extends string>({
  id,
  value,
  onChange,
  options,
  label,
}: {
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-white p-1 ring-1 ring-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="relative rounded-full px-3.5 py-1.5 text-[13.5px] font-medium"
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className={`relative transition-colors duration-200 ${active ? "text-white" : "text-ink-2 hover:text-ink"}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  subTone = "muted",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  subTone?: "muted" | "good";
}) {
  return (
    <div className="rounded-[20px] bg-white p-4 ring-1 ring-line md:p-5">
      <div className="text-[13px] text-ink-3">{label}</div>
      <div className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink md:text-[28px]">{value}</div>
      {sub && <div className={`mt-2 text-[12.5px] ${subTone === "good" ? "text-leaf-700" : "text-ink-3"}`}>{sub}</div>}
    </div>
  );
}

export function TimezoneNotice() {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!browserTz || browserTz === "UTC") return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-leaf-50 px-4 py-3 text-[14px] leading-relaxed text-ink-2 ring-1 ring-leaf-100">
      <Globe size={17} className="mt-[3px] shrink-0 text-leaf-600" />
      <p>
        Days are counted in UTC until you set a timezone. Ask your AI: <span className="text-ink">“Set my timezone to {browserTz}.”</span>
      </p>
    </div>
  );
}

export function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-soft py-3 last:border-b-0">
      <span className="text-[14px] text-ink-2">{label}</span>
      <span className="text-right text-[14.5px] font-medium text-ink">{value}</span>
    </div>
  );
}
