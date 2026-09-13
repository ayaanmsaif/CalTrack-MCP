import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView } from "motion/react";
import { AnimatedNumber, Container, EASE, Reveal, SectionHeader } from "../components/ui";
import { Alert, Bookmark, Check, Globe, Info, Lock, Moon } from "../components/icons";
import { fmtInt } from "../lib/format";

function FeatureCard({
  className = "",
  title,
  body,
  children,
  delay = 0,
}: {
  className?: string;
  title: string;
  body: ReactNode;
  children: ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <Reveal className={className} delay={delay}>
      <div
        ref={ref}
        onPointerMove={onMove}
        className="group relative flex h-full flex-col overflow-hidden rounded-[26px] bg-white p-6 ring-1 ring-line transition-shadow duration-500 hover:shadow-[0_30px_60px_-36px_rgb(13_42_30/0.3)] md:p-7"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 [background:radial-gradient(460px_circle_at_var(--mx,50%)_var(--my,50%),rgb(221_242_228/0.65),transparent_62%)]"
        />
        <div className="relative flex-1">{children}</div>
        <div className="relative mt-7">
          <h3 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
          <p className="mt-2 max-w-[36rem] text-[15px] leading-relaxed text-ink-2 text-pretty">{body}</p>
        </div>
      </div>
    </Reveal>
  );
}

/* ---------- 1. Ingredient breakdown ---------- */

function EntryDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const [bigRice, setBigRice] = useState(false);

  const rows = [
    { name: "Chicken thigh, cooked", amount: "150 g", kcal: 269 },
    { name: "White rice, cooked", amount: bigRice ? "1½ cups" : "1 cup", kcal: bigRice ? 308 : 205 },
    { name: "Olive oil", amount: "1 tbsp", kcal: 119 },
  ];
  const total = rows.reduce((s, r) => s + r.kcal, 0);

  return (
    <div ref={ref} className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
      <div className="rounded-2xl bg-paper p-4 ring-1 ring-line">
        <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
          <div>
            <div className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-ink-3">Lunch</div>
            <div className="mt-0.5 text-[15px] font-medium text-ink">Chicken, rice & olive oil</div>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-semibold leading-none text-ink">
              <AnimatedNumber value={inView ? total : 0} from={0} />
            </div>
            <div className="mt-1 text-[12px] text-ink-3">kcal total</div>
          </div>
        </div>
        <div className="relative mt-2">
          <div aria-hidden="true" className="absolute bottom-3 left-[5px] top-3 w-px bg-leaf-200" />
          {rows.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, x: -6 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, ease: EASE, delay: 0.2 + i * 0.12 }}
              className="relative flex items-center gap-3 py-2 pl-5 text-[14px]"
            >
              <span aria-hidden="true" className="absolute left-0 top-1/2 size-[11px] -translate-y-1/2 rounded-full bg-white ring-[2.5px] ring-leaf-400" />
              <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
              <span className="relative grid shrink-0 text-ink-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={r.amount}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  >
                    {r.amount}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="w-[4.75rem] shrink-0 text-right text-ink tnum">
                <AnimatedNumber value={r.kcal} /> kcal
              </span>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 md:w-[180px]">
        <span className="text-[12.5px] text-ink-3">Fix a portion later:</span>
        <button
          onClick={() => setBigRice((v) => !v)}
          className="rounded-full bg-white px-4 py-2.5 text-left text-[14px] font-medium text-ink ring-1 ring-line transition-[box-shadow,background-color] duration-300 hover:ring-leaf-300 active:scale-[0.98]"
        >
          {bigRice ? "Back to 1 cup" : "Make it 1½ cups"}
        </button>
        <span className="text-[12.5px] text-ink-3">The total recalculates on its own.</span>
      </div>
    </div>
  );
}

/* ---------- 2. Saved meal multiplier ---------- */

function SavedMealDemo() {
  const [n, setN] = useState(1);
  const id = useId();
  const base = [
    { name: "Whole milk", amount: (k: number) => `${250 * k} ml`, kcal: 153 },
    { name: "Whey protein", amount: (k: number) => `${k} scoop${k > 1 ? "s" : ""}`, kcal: 120 },
    { name: "Banana", amount: (k: number) => `${k} medium`, kcal: 105 },
    { name: "Peanut butter", amount: (k: number) => `${k} tbsp`, kcal: 94 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-leaf-50 py-1.5 pl-2 pr-3 text-[13.5px] font-medium text-leaf-800 ring-1 ring-leaf-100">
          <Bookmark size={15} />
          Signature milkshake
        </span>
        <LayoutGroup id={id}>
          <div className="flex rounded-full bg-paper p-1 ring-1 ring-line" role="radiogroup" aria-label="Servings">
            {[1, 2, 3].map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={n === k}
                onClick={() => setN(k)}
                className="relative rounded-full px-3 py-1 text-[13.5px] font-medium tnum"
              >
                {n === k && (
                  <motion.span layoutId="serving-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                )}
                <span className={`relative transition-colors duration-200 ${n === k ? "text-white" : "text-ink-2"}`}>×{k}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>
      <div className="mt-4 space-y-1.5">
        {base.map((r) => (
          <div key={r.name} className="flex items-center gap-3 text-[14px]">
            <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
            <span className="text-ink-3">{r.amount(n)}</span>
            <span className="w-[4.5rem] text-right text-ink tnum">
              <AnimatedNumber value={r.kcal * n} /> kcal
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-[13px] text-ink-3">Copied exactly, never re-estimated</span>
        <span className="text-[20px] font-semibold text-ink">
          <AnimatedNumber value={472 * n} /> <span className="text-[13px] font-normal text-ink-3">kcal</span>
        </span>
      </div>
    </div>
  );
}

/* ---------- 3. Target with guardrails ---------- */

// Worked example: 30-year-old, 178 cm, 75 kg, moderately active.
const BMR = 1717.5;
const TDEE = BMR * 1.55;
const CAP = 0.75; // ~1% of 75 kg
const FLOOR = BMR * 1.2;
const MAX_RATE = 1.5;

function TargetDemo() {
  const [rate, setRate] = useState(0.5);
  const applied = Math.min(rate, CAP);
  const raw = TDEE - applied * 1100;
  const target = Math.max(raw, FLOOR);
  const capped = rate > CAP + 1e-9;
  const floored = raw < FLOOR - 1e-9;
  const pct = (rate / MAX_RATE) * 100;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[12.5px] text-ink-3">Daily target</div>
          <div className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.02em] text-ink">
            <AnimatedNumber value={target} duration={0.5} />
            <span className="ml-1.5 text-[14px] font-normal tracking-normal text-ink-3">kcal</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12.5px] text-ink-3">You asked to lose</div>
          <div className="mt-1 text-[17px] font-medium text-ink tnum">{rate.toFixed(2)} kg/week</div>
        </div>
      </div>

      <div className="relative mt-6">
        <input
          type="range"
          min={0}
          max={MAX_RATE}
          step={0.05}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          aria-label="Weekly weight loss goal in kilograms"
          className="range-input w-full"
          style={{ ["--fill" as string]: `${pct}%` }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -top-1 flex flex-col items-center" style={{ left: `${(CAP / MAX_RATE) * 100}%`, transform: "translateX(-50%)" }}>
          <span className="h-4 w-px bg-ink/40" />
        </div>
        <div className="mt-2 flex justify-between text-[11.5px] text-ink-3 tnum">
          <span>0</span>
          <span style={{ marginLeft: `${(CAP / MAX_RATE) * 100 - 8}%` }}>1% cap</span>
          <span>1.5 kg</span>
        </div>
      </div>

      <div className="mt-4 min-h-[52px] space-y-1.5">
        <AnimatePresence initial={false}>
          {capped && (
            <motion.div
              key="cap"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex items-center gap-2 overflow-hidden text-[13.5px] text-ink-2"
            >
              <Alert size={15} className="shrink-0 text-serious" />
              Pace capped at {CAP} kg/week, about 1% of bodyweight
            </motion.div>
          )}
          {floored && (
            <motion.div
              key="floor"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex items-center gap-2 overflow-hidden text-[13.5px] text-ink-2"
            >
              <Info size={15} className="shrink-0 text-leaf-600" />
              Held at the floor: never below 1.2× resting burn ({fmtInt(FLOOR)})
            </motion.div>
          )}
          {!capped && !floored && (
            <motion.div
              key="ok"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex items-center gap-2 overflow-hidden text-[13.5px] text-ink-2"
            >
              <Check size={15} strokeWidth={2.2} className="shrink-0 text-leaf-600" />
              Within the safe range, no adjustment needed
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- 4. Barcode ---------- */

const BARS = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2, 1, 2, 1, 3];

function BarcodeDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px" });
  let x = 0;
  const rects = BARS.map((w, i) => {
    const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={44} rx={0.3} fill="currentColor" /> : null;
    x += w + 0.9;
    return rect;
  });

  return (
    <div ref={ref}>
      <div className="relative overflow-hidden rounded-2xl bg-paper px-5 py-4 ring-1 ring-line">
        <svg viewBox={`0 0 ${x} 44`} className="h-14 w-full text-ink" preserveAspectRatio="none" aria-hidden="true">
          {rects}
        </svg>
        <div className="mt-2 text-center font-mono text-[12px] tracking-[0.25em] text-ink-3">5 012345 678900</div>
        <motion.div
          aria-hidden="true"
          className="absolute inset-x-3 top-3 h-[2px] rounded-full bg-leaf-500 shadow-[0_0_14px_2px_rgb(23_145_79/0.45)]"
          animate={inView ? { y: [0, 56, 0] } : { y: 0 }}
          transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-line">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium text-ink">Smooth peanut butter</div>
          <div className="mt-0.5 text-[12px] text-ink-3">per 100 g · Open Food Facts</div>
        </div>
        <div className="shrink-0 text-right text-[14px] text-ink tnum">588 kcal</div>
      </div>
    </div>
  );
}

/* ---------- 5. Weight & water ---------- */

const WEIGHTS = [82.4, 82.1, 82.3, 81.9, 81.8, 81.9, 81.5, 81.6, 81.3, 81.2, 81.4, 81.0, 81.1, 80.9];

function TrendsDemo() {
  const w = 300;
  const h = 96;
  const min = Math.min(...WEIGHTS) - 0.3;
  const max = Math.max(...WEIGHTS) + 0.3;
  const pts = WEIGHTS.map((v, i) => [(i / (WEIGHTS.length - 1)) * (w - 12) + 6, h - ((v - min) / (max - min)) * (h - 12) - 6] as const);
  const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[12.5px] text-ink-3">Weight, last 4 weeks</div>
          <div className="mt-1 text-[22px] font-semibold text-ink">
            80.9 <span className="text-[13px] font-normal text-ink-3">kg</span>
          </div>
        </div>
        <div className="rounded-full bg-leaf-50 px-2.5 py-1 text-[12.5px] font-medium text-leaf-700 ring-1 ring-leaf-100">−1.5 kg</div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-24 w-full overflow-visible" aria-hidden="true">
        <line x1="0" x2={w} y1={h - 1} y2={h - 1} stroke="var(--color-line)" strokeWidth="1" />
        <motion.path
          d={d}
          fill="none"
          stroke="var(--color-leaf-500)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
        />
        <motion.circle
          cx={last[0]}
          cy={last[1]}
          r="4.5"
          fill="var(--color-leaf-500)"
          stroke="#fff"
          strokeWidth="2"
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 400, damping: 18, delay: 1.7 }}
        />
      </svg>
      <div className="mt-4 flex items-center gap-2 text-[13px] text-ink-2">
        <span className="size-2 rounded-full bg-protein" />
        Water today: 1,250 ml
      </div>
    </div>
  );
}

/* ---------- 6. Timezones ---------- */

function TimezoneDemo() {
  const [landed, setLanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px" });

  useEffect(() => {
    if (!inView) return;
    const id = window.setInterval(() => setLanded((v) => !v), 3200);
    return () => window.clearInterval(id);
  }, [inView]);

  const city = landed ? "New York" : "London";
  const time = landed ? "18:40" : "23:40";

  return (
    <div ref={ref} className="flex h-full flex-col justify-center gap-3">
      <div className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3 ring-1 ring-line">
        <span className="grid size-9 place-items-center rounded-xl bg-white text-ink-2 ring-1 ring-line">
          {landed ? <Globe size={17} /> : <Moon size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-ink-3">Late snack logged at</div>
          <div className="relative h-5 overflow-hidden text-[14.5px] font-medium text-ink">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={city}
                className="absolute inset-0 tnum"
                initial={{ y: 18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -18, opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                {time} in {city}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 pl-1 text-[13.5px] text-ink-2">
        <Check size={15} strokeWidth={2.2} className="text-leaf-600" />
        Counts toward Tuesday, in local time
      </div>
    </div>
  );
}

/* ---------- 7. Private ---------- */

function PrivateDemo() {
  const apps = [
    { name: "Claude", token: "ct_at_••••7f3a" },
    { name: "ChatGPT", token: "ct_at_••••c21e" },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {apps.map((a, i) => (
        <motion.div
          key={a.name}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.2 + i * 0.12 }}
          className="flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-2.5 ring-1 ring-line"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-white text-leaf-600 ring-1 ring-line">
            <Lock size={15} />
          </span>
          <span className="flex-1 text-[14px] font-medium text-ink">{a.name}</span>
          <span className="font-mono text-[12px] text-ink-3">{a.token}</span>
        </motion.div>
      ))}
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="scroll-mt-16 py-24 md:py-32">
      <Container>
        <SectionHeader
          eyebrow="What's under the hood"
          title={
            <>
              The details that make the habit <em>stick</em>.
            </>
          }
          body="Adding up calories isn't the hard part. Keeping the numbers consistent, and the logging quick enough that you keep doing it, is."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            className="md:col-span-2"
            title="Every meal, down to the ingredient"
            body="Entries are stored as their parts, and the database adds them up itself. Fix a portion later and the total follows, so the two can never drift apart."
          >
            <EntryDemo />
          </FeatureCard>

          <FeatureCard
            delay={0.08}
            title="Save a meal once, call it by name"
            body="Tell it to save your usual breakfast. After that, “my usual breakfast, double” logs an exact copy, scaled."
          >
            <SavedMealDemo />
          </FeatureCard>

          <FeatureCard
            title="A target with guardrails"
            body="Worked out from your height, weight, age and activity. Ask for a crash-diet pace and it caps it at about 1% of your bodyweight a week. Drag it and see."
          >
            <TargetDemo />
          </FeatureCard>

          <FeatureCard
            delay={0.08}
            title="Packet in hand? Use the barcode"
            body="Read out the number on the back and it pulls the label from Open Food Facts instead of estimating."
          >
            <BarcodeDemo />
          </FeatureCard>

          <FeatureCard
            delay={0.16}
            title="Weight and water in the same chat"
            body="Log a weigh-in or a glass of water the way you log food, then ask how the month went."
          >
            <TrendsDemo />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-1 lg:col-span-2"
            title="Days that follow you"
            body="A midnight snack lands on the right day. Travelling? Tell it where you've landed and your days switch to local time."
          >
            <TimezoneDemo />
          </FeatureCard>

          <FeatureCard
            delay={0.08}
            title="Each app gets its own key"
            body="Claude and ChatGPT sign in separately, and each gets access to your account only."
          >
            <PrivateDemo />
          </FeatureCard>
        </div>
      </Container>
    </section>
  );
}
