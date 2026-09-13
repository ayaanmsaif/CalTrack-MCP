import { Fragment, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { AnimatedNumber, ButtonLink, Container, EASE } from "../components/ui";
import { ArrowRight, Check, Plug, Sparkle } from "../components/icons";
import { Ring } from "../components/Ring";
import { fmtInt } from "../lib/format";

const TARGET = 2100;
const CHAR_MS = 26;

type Row = { name: string; amount: string; kcal: number };
type Bar = { label: string; value: number; target: number; unit: string; color: string };
type Scene = {
  history: { user: string; reply: string };
  user: string;
  tool: string;
  rows?: Row[];
  total?: { kcal: number; p: number; c: number; f: number };
  bars?: Bar[];
  reply: string;
  before: number;
  after: number;
};

const SCENES: Scene[] = [
  {
    history: { user: "Porridge with a banana for breakfast", reply: "Logged as breakfast: 3 ingredients." },
    user: "Lunch was 150g chicken thigh, a cup of cooked rice and a tablespoon of olive oil",
    tool: "log_food_entry",
    rows: [
      { name: "Chicken thigh, cooked", amount: "150 g", kcal: 269 },
      { name: "White rice, cooked", amount: "1 cup", kcal: 205 },
      { name: "Olive oil", amount: "1 tbsp", kcal: 119 },
    ],
    total: { kcal: 593, p: 42, c: 45, f: 26 },
    reply: "Logged as lunch. You're on 1,247 of 2,100 kcal, so 853 left for today.",
    before: 654,
    after: 1247,
  },
  {
    history: { user: "Weighed in at 80.9 kg this morning", reply: "Logged. That's 1.5 kg down on last month." },
    user: "Two servings of my signature milkshake",
    tool: "log_saved_meal",
    rows: [
      { name: "Whole milk", amount: "500 ml", kcal: 306 },
      { name: "Whey protein", amount: "2 scoops", kcal: 240 },
      { name: "Banana", amount: "2 medium", kcal: 210 },
      { name: "Peanut butter", amount: "2 tbsp", kcal: 188 },
    ],
    total: { kcal: 944, p: 76, c: 90, f: 36 },
    reply: "Copied from your saved meal and doubled. Same numbers as last time, nothing re-estimated.",
    before: 380,
    after: 1324,
  },
  {
    history: { user: "My usual oats, please", reply: "Done, same as yesterday: 458 kcal." },
    user: "How much protein have I got left today?",
    tool: "get_goal_progress",
    bars: [
      { label: "Calories", value: 1324, target: 2100, unit: "kcal", color: "var(--color-leaf-500)" },
      { label: "Protein", value: 118, target: 160, unit: "g", color: "var(--color-protein)" },
      { label: "Carbs", value: 142, target: 236, unit: "g", color: "var(--color-carbs)" },
      { label: "Fat", value: 49, target: 58, unit: "g", color: "var(--color-fat)" },
    ],
    reply: "42 g of protein left. A tin of tuna and a pot of Greek yoghurt would about cover it.",
    before: 1324,
    after: 1324,
  },
];

function SplitHeadline() {
  const words: { t: string; em?: boolean }[] = [{ t: "Just" }, { t: "say", em: true }, { t: "what" }, { t: "you" }, { t: "ate." }];
  return (
    <h1 className="mt-7 font-serif text-[clamp(3.5rem,8.4vw,6.75rem)] leading-[0.92] tracking-[-0.025em] text-ink">
      <span className="sr-only">Just say what you ate.</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <Fragment key={i}>
            <span className="-mb-[0.14em] -mr-[0.1em] inline-block overflow-hidden pb-[0.14em] pr-[0.1em] align-bottom">
              <motion.span
                className={`inline-block ${w.em ? "italic text-leaf-600" : ""}`}
                initial={{ y: "108%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.07 }}
              >
                {w.t}
              </motion.span>
            </span>
            {i < words.length - 1 && " "}
          </Fragment>
        ))}
      </span>
    </h1>
  );
}

function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgb(13_42_30/0.075)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_70%_60%_at_60%_30%,black,transparent_75%)]" />
      <div className="absolute -top-56 right-[-14%] size-[720px] rounded-full will-change-transform animate-drift [background:radial-gradient(closest-side,rgb(187_228_201/0.8),transparent)]" />
      <div className="absolute top-[38%] -left-56 size-[560px] rounded-full will-change-transform animate-drift [animation-delay:-11s] [background:radial-gradient(closest-side,rgb(217_249_157/0.5),transparent)]" />
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-24 pt-28 md:pb-32 md:pt-36">
      <HeroBackdrop />
      <Container className="relative grid items-center gap-16 lg:grid-cols-[1.02fr_1fr] lg:gap-12">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2.5 rounded-full bg-white/85 py-1.5 pl-2.5 pr-3.5 text-[13px] text-ink-2 ring-1 ring-line backdrop-blur"
          >
            <span className="size-2 rounded-full bg-leaf-500 animate-pulse-dot" />
            Works with Claude, ChatGPT and other MCP apps
          </motion.div>

          <SplitHeadline />

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}
            className="mt-7 max-w-[33rem] text-[18px] leading-[1.6] text-ink-2 text-pretty md:text-[19px]"
          >
            CalTrack plugs into Claude and ChatGPT. Describe a meal the way you'd text a friend, and it's logged ingredient by
            ingredient, macros worked out, daily total kept up to date.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.68 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <ButtonLink href="#connect" className="h-12 px-6 text-[15.5px]">
              Connect your AI
              <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink href="#how" variant="secondary" className="h-12 px-6 text-[15.5px]">
              See how it works
            </ButtonLink>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.85 }}
            className="mt-6 text-[13.5px] text-ink-3"
          >
            Nothing to install. Sign in with Google or email.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.3 }}
          className="relative mx-auto w-full max-w-[540px] lg:mx-0 lg:justify-self-end"
        >
          <ChatDemo />
        </motion.div>
      </Container>
    </section>
  );
}

function TypedText({ text, active, instant }: { text: string; active: boolean; instant: boolean }) {
  const [n, setN] = useState(instant ? text.length : 0);

  useEffect(() => {
    if (instant) {
      setN(text.length);
      return;
    }
    setN(0);
    if (!active) return;
    // Driven by elapsed time rather than counting ticks, so typing stays in
    // step with the scene timeline even when a busy device delays timers.
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const next = Math.min(text.length, Math.floor((now - start) / CHAR_MS));
      setN(next);
      if (next < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, active, instant]);

  const typing = n < text.length;
  return (
    <span className="relative block">
      <span className="invisible">{text}</span>
      <span className="absolute inset-0">
        {text.slice(0, n)}
        {typing && <span className="ml-[1px] inline-block h-[1.1em] w-[2px] translate-y-[0.18em] rounded-full bg-lime/90" />}
      </span>
    </span>
  );
}

function ToolPill({ name, done }: { name: string; done: boolean }) {
  return (
    <div className="relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-leaf-50 py-1 pl-1.5 pr-3 ring-1 ring-leaf-100">
      <span className="relative grid size-5 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          {done ? (
            <motion.span
              key="done"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className="absolute grid size-5 place-items-center rounded-full bg-leaf-500 text-white"
            >
              <Check size={12} strokeWidth={2.6} />
            </motion.span>
          ) : (
            <motion.span
              key="spin"
              exit={{ opacity: 0, scale: 0.6 }}
              className="absolute block size-3.5 animate-spin rounded-full border-[1.75px] border-leaf-200 border-t-leaf-600"
            />
          )}
        </AnimatePresence>
      </span>
      <span className="font-mono text-[12.5px] text-leaf-800">{name}</span>
      {!done && <span aria-hidden="true" className="absolute inset-0 animate-shimmer shimmer-bg" />}
    </div>
  );
}

function ChatDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });
  const reduced = useReducedMotion() ?? false;
  const [sceneIdx, setSceneIdx] = useState(0);
  const [phase, setPhase] = useState(0);
  const scene = SCENES[sceneIdx];

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setPhase(4);
      const t = window.setTimeout(() => setSceneIdx((i) => (i + 1) % SCENES.length), 7000);
      return () => window.clearTimeout(t);
    }
    setPhase(0);
    const typing = scene.user.length * CHAR_MS + 450;
    const results = (scene.rows?.length ?? scene.bars?.length ?? 0) * 130;
    const at = [typing, typing + 1000, typing + 1000 + results + 450, typing + 1000 + results + 1150];
    const hold = at[3] + 3800;
    const timers = [
      window.setTimeout(() => setPhase(1), at[0]),
      window.setTimeout(() => setPhase(2), at[1]),
      window.setTimeout(() => setPhase(3), at[2]),
      window.setTimeout(() => setPhase(4), at[3]),
      window.setTimeout(() => setPhase(5), hold),
      window.setTimeout(() => setSceneIdx((i) => (i + 1) % SCENES.length), hold + 450),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
    // scene is derived from sceneIdx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIdx, inView, reduced]);

  const eaten = phase >= 3 ? scene.after : scene.before;

  return (
    <div ref={ref} className="relative">
      <div className="relative h-[600px] overflow-hidden rounded-[30px] bg-white shadow-[0_1px_0_rgb(13_42_30/0.04),0_40px_80px_-40px_rgb(13_42_30/0.35),0_0_0_1px_var(--color-line)] sm:h-[560px]">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-ink/10" />
              <span className="size-2.5 rounded-full bg-ink/10" />
              <span className="size-2.5 rounded-full bg-ink/10" />
            </span>
            <span className="ml-2 text-[13px] text-ink-3">Your AI chat</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-2.5 py-1 text-[12px] font-medium text-leaf-700 ring-1 ring-leaf-100">
            <Plug size={13} />
            CalTrack
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={sceneIdx}
            className="absolute inset-x-0 bottom-0 top-[53px] flex flex-col justify-end gap-4 p-5 [mask-image:linear-gradient(to_bottom,transparent,black_64px)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 5 ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <motion.div layout="position" transition={{ layout: { duration: 0.55, ease: EASE } }} className="flex flex-col gap-3 opacity-55">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-[18px] rounded-br-md bg-leaf-950 px-3.5 py-2.5 text-[14px] leading-[1.4] text-white">
                  {scene.history.user}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="grid size-6 shrink-0 place-items-center rounded-full bg-leaf-50 text-leaf-600 ring-1 ring-leaf-100">
                  <Sparkle size={12} />
                </div>
                <p className="text-[14px] text-ink-2">{scene.history.reply}</p>
              </div>
            </motion.div>

            <motion.div layout="position" transition={{ layout: { duration: 0.55, ease: EASE } }} className="flex justify-end">
              <div className="max-w-[84%] rounded-[20px] rounded-br-md bg-leaf-950 px-4 py-3 text-[15px] leading-[1.45] text-white">
                <TypedText text={scene.user} active={inView} instant={reduced} />
              </div>
            </motion.div>

            <AnimatePresence>
              {phase >= 1 && (
                <motion.div
                  key="assistant"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: EASE }}
                  className="flex gap-3"
                >
                  <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-leaf-50 text-leaf-600 ring-1 ring-leaf-100">
                    <Sparkle size={14} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <ToolPill name={scene.tool} done={phase >= 2} />

                    <div className="rounded-2xl bg-paper px-3.5 py-2.5 ring-1 ring-line">
                      {scene.rows?.map((r, i) => (
                        <motion.div
                          key={r.name}
                          initial={{ opacity: 0, y: 6 }}
                          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                          transition={{ duration: 0.4, ease: EASE, delay: phase >= 2 ? i * 0.13 : 0 }}
                          className="flex items-baseline gap-3 py-[5px] text-[14px]"
                        >
                          <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
                          <span className="shrink-0 text-ink-3">{r.amount}</span>
                          <span className="w-[4.5rem] shrink-0 text-right text-ink tnum">{fmtInt(r.kcal)} kcal</span>
                        </motion.div>
                      ))}

                      {scene.bars?.map((b, i) => (
                        <div key={b.label} className="py-[5px]">
                          <div className="mb-1.5 flex items-baseline justify-between text-[13.5px]">
                            <span className="text-ink">{b.label}</span>
                            <span className="text-ink-2 tnum">
                              {fmtInt(b.value)} / {fmtInt(b.target)} {b.unit}
                            </span>
                          </div>
                          <div
                            className="h-1.5 overflow-hidden rounded-full"
                            style={{ background: `color-mix(in oklab, ${b.color} 16%, white)` }}
                          >
                            <motion.div
                              className="h-full origin-left rounded-full"
                              style={{ background: b.color }}
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: phase >= 2 ? Math.min(b.value / b.target, 1) : 0 }}
                              transition={{ duration: 0.8, ease: EASE, delay: phase >= 2 ? i * 0.13 : 0 }}
                            />
                          </div>
                        </div>
                      ))}

                      {scene.total && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: phase >= 3 ? 1 : 0 }}
                          transition={{ duration: 0.45 }}
                          className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-2"
                        >
                          <span className="text-[14px] font-semibold text-ink tnum">{fmtInt(scene.total.kcal)} kcal</span>
                          <span className="flex items-center gap-3 text-[12.5px] text-ink-2">
                            <MacroKey color="var(--color-protein)" label={`${scene.total.p}g protein`} />
                            <MacroKey color="var(--color-carbs)" label={`${scene.total.c}g carbs`} />
                            <MacroKey color="var(--color-fat)" label={`${scene.total.f}g fat`} />
                          </span>
                        </motion.div>
                      )}
                    </div>

                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                      transition={{ duration: 0.5, ease: EASE }}
                      className="text-[14.5px] leading-relaxed text-ink-2"
                    >
                      {scene.reply}
                    </motion.p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE, delay: 1.1 }}
        className="absolute -bottom-16 -left-4 hidden items-center gap-3 rounded-[20px] bg-white py-2.5 pl-2.5 pr-4 shadow-[0_24px_48px_-20px_rgb(13_42_30/0.35),0_0_0_1px_var(--color-line)] sm:flex lg:-left-10"
      >
        <Ring size={46} stroke={5} ratio={eaten / TARGET} />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-ink">
            <AnimatedNumber value={TARGET - eaten} /> kcal left
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-3">of {fmtInt(TARGET)} today</div>
        </div>
      </motion.div>
    </div>
  );
}

function MacroKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
