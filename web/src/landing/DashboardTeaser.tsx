import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ButtonLink, Container, Reveal, SectionHeader } from "../components/ui";
import { ArrowRight } from "../components/icons";
import { Ring } from "../components/Ring";

const WEEK = [
  { d: "M", r: 0.96 },
  { d: "T", r: 1.04 },
  { d: "W", r: 0.88 },
  { d: "T", r: 0.93 },
  { d: "F", r: 1.12 },
  { d: "S", r: 0.81 },
  { d: "S", r: 0.59, today: true },
];

const MEALS = [
  { type: "Breakfast", name: "Porridge with banana", kcal: 412 },
  { type: "Lunch", name: "Chicken, rice & olive oil", kcal: 593 },
  { type: "Snack", name: "Greek yoghurt & berries", kcal: 242 },
];

const MACROS = [
  { label: "Protein", v: 118, t: 160, c: "var(--color-protein)" },
  { label: "Carbs", v: 142, t: 236, c: "var(--color-carbs)" },
  { label: "Fat", v: 49, t: 58, c: "var(--color-fat)" },
];

function FauxDashboard() {
  return (
    <div className="rounded-[22px] bg-paper p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] text-ink-3">Sunday</div>
          <div className="text-[18px] font-semibold tracking-[-0.01em] text-ink">Today</div>
        </div>
        <div className="hidden gap-1.5 sm:flex">
          {WEEK.map((w, i) => (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 rounded-xl px-1.5 py-1.5 ${w.today ? "bg-white ring-1 ring-line" : ""}`}
            >
              <span className="text-[10px] text-ink-3">{w.d}</span>
              <Ring size={22} stroke={3} ratio={w.r} delay={0.1 * i} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center rounded-2xl bg-white p-5 ring-1 ring-line">
          <Ring size={148} stroke={13} ratio={1247 / 2100} delay={0.2}>
            <span className="text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">853</span>
            <span className="mt-1 text-[12px] text-ink-3">kcal left</span>
          </Ring>
        </div>
        <div className="flex flex-col justify-center gap-3.5 rounded-2xl bg-white p-5 ring-1 ring-line">
          {MACROS.map((m) => (
            <div key={m.label}>
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="text-ink">{m.label}</span>
                <span className="text-ink-3 tnum">
                  {m.v} / {m.t} g
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, ${m.c} 16%, white)` }}>
                <div className="h-full rounded-full" style={{ width: `${(m.v / m.t) * 100}%`, background: m.c }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
        {MEALS.map((m) => (
          <div key={m.name} className="flex items-center gap-3 px-4 py-3">
            <span className="w-[4.5rem] text-[12px] text-ink-3">{m.type}</span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{m.name}</span>
            <span className="text-[14px] text-ink tnum">{m.kcal} kcal</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardTeaser() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [16, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [70, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);

  return (
    <section className="overflow-hidden py-24 md:py-32">
      <Container className="grid items-center gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
        <div>
          <SectionHeader
            eyebrow="The dashboard"
            title={
              <>
                Rather <em>look</em> than ask?
              </>
            }
            body="Today's meals, what's left, and how the week is going, on the same account your AI writes to. Nothing to sync or import."
          />
          <Reveal delay={0.1} className="mt-8">
            <ButtonLink to="/app">
              Open the dashboard
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </ButtonLink>
          </Reveal>
        </div>
        <div ref={ref} className="[perspective:1800px]">
          <motion.div
            style={{ rotateX, y, scale }}
            className="origin-bottom rounded-[30px] bg-white p-2.5 shadow-[0_60px_120px_-60px_rgb(13_42_30/0.45),0_0_0_1px_var(--color-line)] will-change-transform"
          >
            <FauxDashboard />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
