import { useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Container, Eyebrow, EASE, Reveal, useMediaQuery } from "../components/ui";
import { Check, ListIcon, Plus, Question, Scale, Search } from "../components/icons";

type Step = { icon: ComponentType<{ size?: number; className?: string }>; text: string; chips?: string[] };

const STEPS: Step[] = [
  { icon: Search, text: "Search “chicken thigh”" },
  { icon: ListIcon, text: "Pick one of 43 lookalike results", chips: ["179", "209", "229", "247"] },
  { icon: Question, text: "Was that raw weight or cooked?" },
  { icon: Scale, text: "Choose a serving: 1 thigh, 100 g, 1 oz…" },
  { icon: Search, text: "Search “rice”" },
  { icon: ListIcon, text: "Basmati, jasmine, cooked, dry…" },
  { icon: Scale, text: "Work out what 1 cup is in grams" },
  { icon: Search, text: "Search “olive oil”" },
  { icon: Plus, text: "Add all three to Lunch" },
];

const MESSAGE = "Lunch was 150g chicken thigh, a cup of rice and a tablespoon of olive oil";

const INGREDIENTS = [
  { name: "Chicken thigh", kcal: 269 },
  { name: "White rice", kcal: 205 },
  { name: "Olive oil", kcal: 119 },
];

function Copy() {
  return (
    <div>
      <Eyebrow>The usual way</Eyebrow>
      <h2 className="mt-4 font-serif text-[clamp(2.5rem,5.2vw,4.25rem)] leading-[1] tracking-[-0.015em] text-balance text-ink">
        Food apps turned eating into <em className="italic text-leaf-600">data entry</em>.
      </h2>
      <p className="mt-6 max-w-[31rem] text-[17px] leading-relaxed text-ink-2 text-pretty">
        Try logging one home-cooked lunch. Search for chicken thigh and scroll past dozens of lookalike entries, most typed in
        by other users. Decide whether the label meant raw or cooked. Guess the portion. Then do the rice. Then the oil you
        nearly forgot.
      </p>
      <p className="mt-4 max-w-[31rem] text-[17px] leading-relaxed text-ink-2 text-pretty">
        It's no wonder so many food logs go quiet after a couple of weeks. With CalTrack, that whole lunch is one message.
      </p>
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  const Icon = step.icon;
  return (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-paper text-ink-2 ring-1 ring-line">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">{step.text}</span>
      {step.chips && (
        <span className="hidden shrink-0 gap-1 xl:flex">
          {step.chips.map((c) => (
            <span key={c} className="rounded-md bg-paper px-1.5 py-0.5 text-[11.5px] text-ink-3 ring-1 ring-line tnum">
              {c}
            </span>
          ))}
        </span>
      )}
    </>
  );
}

type Stage = 0 | 1 | 2;

function StackedCard({ step, index, stage }: { step: Step; index: number; stage: Stage }) {
  // In the pile the top card sits nearly straight and the ones underneath
  // fan out a little more, so it reads as a tidy stack rather than a heap.
  const fromTop = STEPS.length - 1 - index;
  const target =
    stage === 0
      ? { y: index * 60, rotate: 0, scale: 1 }
      : { y: 226 + index * 4, rotate: (index % 2 === 0 ? -1 : 1) * (0.8 + fromTop * 0.5), scale: 0.93 };

  return (
    <motion.div
      initial={false}
      animate={target}
      transition={{
        type: "spring",
        stiffness: 180,
        damping: 24,
        mass: 0.9,
        delay: stage === 0 ? (STEPS.length - 1 - index) * 0.025 : index * 0.035,
      }}
      className="absolute inset-x-6 top-0 flex h-[52px] items-center gap-3 rounded-2xl bg-white px-3 shadow-[0_1px_2px_rgb(13_42_30/0.06)] ring-1 ring-line will-change-transform"
    >
      <StepRow step={step} />
    </motion.div>
  );
}

function ProblemDesktop() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [stage, setStage] = useState<Stage>(0);

  // Scroll only picks the stage; each transition then plays out on its own.
  // Wherever the reader stops, the scene is in a clean state, never a
  // half-faded blend of the list and the message.
  useMotionValueEvent(scrollYProgress, "change", (v) => setStage(v < 0.26 ? 0 : v < 0.52 ? 1 : 2));

  return (
    <section ref={ref} className="relative h-[270vh]">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <Container className="grid grid-cols-[1fr_1fr] items-center gap-16">
          <Copy />
          <div className="relative h-[620px]">
            <div className="absolute inset-0 rounded-[34px] bg-gradient-to-b from-leaf-50 to-transparent ring-1 ring-line-soft" />

            <div className="absolute inset-x-6 top-6 h-6 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={stage === 2 ? "one" : "many"}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="absolute inset-0 flex items-center gap-2 text-[13px] text-ink-3"
                >
                  {stage === 2 ? (
                    <>
                      <span className="font-medium text-leaf-700">1 message</span> for the same lunch
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-ink-2">9 steps, 3 searches</span> for one lunch
                    </>
                  )}
                </motion.p>
              </AnimatePresence>
            </div>

            <motion.div
              initial={false}
              animate={stage === 2 ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute inset-x-0 top-[62px] origin-[50%_280px]"
            >
              {STEPS.map((s, i) => (
                <StackedCard key={i} step={s} index={i} stage={stage} />
              ))}
            </motion.div>

            <motion.div
              initial={false}
              animate={stage === 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 24 }}
              transition={{ duration: 0.6, ease: EASE, delay: stage === 2 ? 0.25 : 0 }}
              className="pointer-events-none absolute inset-x-8 top-[222px] will-change-transform"
            >
              <div className="ml-auto max-w-[92%] rounded-[22px] rounded-br-md bg-leaf-950 px-5 py-4 text-[16.5px] leading-[1.45] text-white shadow-[0_30px_60px_-30px_rgb(5_36_23/0.6)]">
                {MESSAGE}
              </div>
              <motion.div
                initial={false}
                animate={stage === 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.45, ease: EASE, delay: stage === 2 ? 0.7 : 0 }}
                className="mt-3 flex items-center justify-end gap-2 text-[13.5px] text-ink-2"
              >
                <span className="grid size-5 place-items-center rounded-full bg-leaf-500 text-white">
                  <Check size={12} strokeWidth={2.6} />
                </span>
                Logged as lunch: 3 ingredients, 593 kcal
              </motion.div>
              <div className="mt-5 flex flex-wrap justify-end gap-1.5">
                {INGREDIENTS.map((ing, i) => (
                  <motion.span
                    key={ing.name}
                    initial={false}
                    animate={stage === 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                    transition={{ duration: 0.4, ease: EASE, delay: stage === 2 ? 0.9 + i * 0.08 : 0 }}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[13px] text-ink shadow-[0_1px_2px_rgb(13_42_30/0.05)] ring-1 ring-line"
                  >
                    {ing.name}
                    <span className="text-ink-3 tnum">{ing.kcal} kcal</span>
                  </motion.span>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </div>
    </section>
  );
}

function ProblemMobile() {
  return (
    <section className="py-24">
      <Container>
        <Reveal>
          <Copy />
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Reveal className="rounded-[26px] bg-white p-4 ring-1 ring-line">
            <p className="px-1 pb-3 text-[13px] text-ink-3">
              <span className="font-medium text-ink-2">9 steps, 3 searches</span>
            </p>
            <div className="space-y-2">
              {STEPS.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, ease: EASE, delay: i * 0.05 }}
                  className="flex h-11 items-center gap-3 rounded-xl bg-paper/60 px-2 ring-1 ring-line-soft"
                >
                  <StepRow step={s} />
                </motion.div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col justify-center rounded-[26px] bg-leaf-50 p-5 ring-1 ring-leaf-100">
            <p className="pb-4 text-[13px] text-ink-3">
              <span className="font-medium text-leaf-700">1 message</span>
            </p>
            <div className="rounded-[20px] rounded-br-md bg-leaf-950 px-4 py-3.5 text-[15.5px] leading-[1.45] text-white">{MESSAGE}</div>
            <div className="mt-3 flex items-center gap-2 text-[13.5px] text-ink-2">
              <span className="grid size-5 place-items-center rounded-full bg-leaf-500 text-white">
                <Check size={12} strokeWidth={2.6} />
              </span>
              Logged: 3 ingredients, 593 kcal
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

export function Problem() {
  const desktop = useMediaQuery("(min-width: 1024px) and (min-height: 700px)");
  return desktop ? <ProblemDesktop /> : <ProblemMobile />;
}
