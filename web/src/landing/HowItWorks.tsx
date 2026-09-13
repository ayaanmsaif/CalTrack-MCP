import { motion } from "motion/react";
import { Container, EASE, Reveal, SectionHeader } from "../components/ui";
import { Check, GoogleIcon } from "../components/icons";
import { Ring } from "../components/Ring";
import { mcpUrl } from "../config";

function ConnectIllustration() {
  const shownUrl = `${new URL(mcpUrl).host}/mcp`;
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      <div className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-ink-3">Custom connector</div>
      <div className="flex items-center gap-2">
        <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-white px-2.5 ring-1 ring-line">
          <motion.span
            className="absolute inset-y-0 left-2.5 right-2.5 flex items-center truncate font-mono text-[12px] text-ink-2"
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            whileInView={{ clipPath: "inset(0 0% 0 0)" }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: "linear", delay: 0.3 }}
          >
            {shownUrl}
          </motion.span>
        </div>
        <motion.span
          initial={{ scale: 1 }}
          whileInView={{ scale: [1, 0.92, 1] }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 1.5 }}
          className="grid h-9 place-items-center rounded-lg bg-ink px-3 text-[12.5px] font-medium text-white"
        >
          Add
        </motion.span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE, delay: 1.9 }}
        className="flex items-center gap-2 self-start rounded-full bg-white py-1.5 pl-2 pr-3 text-[12.5px] text-ink-2 ring-1 ring-line"
      >
        <GoogleIcon size={14} />
        Signed in
        <Check size={14} strokeWidth={2.4} className="text-leaf-600" />
      </motion.div>
    </div>
  );
}

function TalkIllustration() {
  const lines = ["Two eggs and toast with butter", "Same breakfast as yesterday", "My usual smoothie, but a double"];
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {lines.map((l, i) => (
        <motion.div
          key={l}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.3 + i * 0.35 }}
          className="max-w-[88%] self-end rounded-2xl rounded-br-md bg-leaf-950 px-3 py-2 text-[13px] text-white"
        >
          {l}
        </motion.div>
      ))}
    </div>
  );
}

function GlanceIllustration() {
  return (
    <div className="flex h-full items-center gap-4">
      <Ring size={92} stroke={9} ratio={0.59} delay={0.3}>
        <span className="text-[17px] font-semibold leading-none text-ink">853</span>
        <span className="mt-0.5 text-[10.5px] text-ink-3">kcal left</span>
      </Ring>
      <div className="flex-1 space-y-2.5">
        {[
          { label: "Protein", v: 0.74, c: "var(--color-protein)" },
          { label: "Carbs", v: 0.6, c: "var(--color-carbs)" },
          { label: "Fat", v: 0.84, c: "var(--color-fat)" },
        ].map((m, i) => (
          <div key={m.label}>
            <div className="mb-1 text-[11.5px] text-ink-2">{m.label}</div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, ${m.c} 16%, white)` }}>
              <motion.div
                className="h-full origin-left rounded-full"
                style={{ background: m.c }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: m.v }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.5 + i * 0.12 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: "Connect it once",
    body: "Add CalTrack as a custom connector in Claude or ChatGPT, then sign in with Google or GitHub. It takes about a minute and you only do it once.",
    Illustration: ConnectIllustration,
  },
  {
    title: "Talk like a person",
    body: "Grams, cups, “a handful”, “same as yesterday”. Say it however you'd normally say it. If a portion's unclear, it asks rather than guessing.",
    Illustration: TalkIllustration,
  },
  {
    title: "Ask, or just look",
    body: "Ask what's left for today and get a straight answer, or open the dashboard for your meals, macros and the week so far.",
    Illustration: GlanceIllustration,
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-16 py-24 md:py-32">
      <Container>
        <SectionHeader
          eyebrow="How it works"
          title={
            <>
              Three steps, and two of them <em>are eating</em>.
            </>
          }
        />

        <div className="relative mt-14 grid gap-4 md:grid-cols-3">
          <svg aria-hidden="true" className="pointer-events-none absolute left-[16%] right-[16%] top-[58px] hidden h-2 md:block" preserveAspectRatio="none" viewBox="0 0 100 2">
            <motion.line
              x1="0"
              y1="1"
              x2="100"
              y2="1"
              stroke="var(--color-leaf-300)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="0"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}
            />
          </svg>

          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1} className="relative">
              <div className="flex h-full flex-col rounded-[26px] bg-white p-6 ring-1 ring-line md:p-7">
                <span className="relative z-10 grid size-9 place-items-center rounded-full bg-leaf-500 font-mono text-[13px] font-medium text-white ring-[6px] ring-paper">
                  {i + 1}
                </span>
                <div className="mt-6 h-[140px] rounded-2xl bg-paper p-4 ring-1 ring-line-soft">
                  <s.Illustration />
                </div>
                <h3 className="mt-6 text-[19px] font-semibold tracking-[-0.01em] text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2 text-pretty">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
