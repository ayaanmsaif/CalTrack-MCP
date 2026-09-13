import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "../components/ui";
import { Bookmark, ChevronDown, Search } from "../components/icons";
import { useSavedMeals } from "../lib/queries";
import { fmtInt } from "../lib/format";
import type { SavedMeal } from "../lib/types";
import { Card, Collapse, EmptyState, IngredientTable, MacroGrams, MacroSplit, PageHeader, PromptChip, Skeleton } from "./components";

export function SavedMeals() {
  const q = useSavedMeals();
  const [query, setQuery] = useState("");
  const all = q.data ?? [];
  const needle = query.trim().toLowerCase();
  const meals = needle
    ? all.filter((m) => m.name.toLowerCase().includes(needle) || (m.description ?? "").toLowerCase().includes(needle))
    : all;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Library" title="Saved meals" />

      {q.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40 rounded-[24px]" />
          <Skeleton className="h-40 rounded-[24px]" />
        </div>
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bookmark}
            title="No saved meals yet"
            body="Log something you eat often, then ask your AI to save it. After that you can log it by name, in any quantity."
          >
            <PromptChip text="Save that as my usual breakfast" />
          </EmptyState>
        </Card>
      ) : (
        <>
          <label className="relative block max-w-[420px]">
            <span className="sr-only">Search saved meals</span>
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${all.length} saved meal${all.length === 1 ? "" : "s"}`}
              className="h-11 w-full rounded-full bg-white pl-11 pr-4 text-[15px] text-ink ring-1 ring-line outline-none transition-shadow placeholder:text-ink-3 focus:ring-2 focus:ring-leaf-500"
            />
          </label>

          <div className="grid items-start gap-3 md:grid-cols-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {meals.map((m) => (
                <MealCard key={m.id} meal={m} />
              ))}
            </AnimatePresence>
          </div>

          {meals.length === 0 && <p className="py-8 text-center text-[14.5px] text-ink-3">No saved meals match “{query}”.</p>}
        </>
      )}
    </div>
  );
}

function MealCard({ meal }: { meal: SavedMeal }) {
  const [open, setOpen] = useState(false);
  const count = meal.saved_meal_ingredients.length;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="rounded-[24px] bg-white ring-1 ring-line"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-[16.5px] font-semibold tracking-[-0.01em] text-ink">{meal.name}</h3>
            <p className="mt-0.5 line-clamp-1 min-h-[20px] text-[13.5px] text-ink-2">{meal.description ?? ""}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">{fmtInt(meal.calories)}</div>
            <div className="mt-1 text-[12px] text-ink-3">kcal</div>
          </div>
        </div>
        <MacroSplit macros={meal} className="mt-4 max-w-none" />
        <MacroGrams macros={meal} className="mt-2.5" />
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-t border-line-soft px-5 py-3 text-[13.5px] text-ink-2 transition-colors hover:text-ink"
      >
        {count} ingredient{count === 1 ? "" : "s"}
        <ChevronDown size={16} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <Collapse open={open}>
        <div className="px-5 pb-4">
          <IngredientTable items={meal.saved_meal_ingredients} />
          <p className="mt-3 text-[12.5px] text-ink-3">Log it by saying “{meal.name}”, or “{meal.name}, two servings”.</p>
        </div>
      </Collapse>
    </motion.div>
  );
}
