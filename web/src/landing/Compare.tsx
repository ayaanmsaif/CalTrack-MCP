import { motion } from "motion/react";
import { Container, EASE, Reveal, SectionHeader } from "../components/ui";
import { Check, X } from "../components/icons";
import { LogoMark } from "../components/Logo";

const ROWS: [string, string, string][] = [
  ["Logging a home-cooked meal", "A search and a portion picker for every ingredient", "One sentence, in your own words"],
  ["Where it happens", "Another app to open and remember", "The AI chat you already use"],
  ["Where the numbers come from", "Crowd-sourced entries, often duplicated", "Per-ingredient estimates, packet labels and barcodes"],
  ["Meals you eat every week", "Dig through recents and hope it's the same one", "Saved by name and copied exactly"],
  ["Your daily target", "One generic figure", "Worked out from your stats, with safety caps"],
  ["Checking how you're doing", "Open the app and read the charts", "Ask, or glance at the dashboard"],
];

export function Compare() {
  return (
    <section id="compare" className="scroll-mt-16 py-24 md:py-32">
      <Container>
        <SectionHeader
          eyebrow="Compared with the usual app"
          title={
            <>
              Same goal. <em>Far less fiddling.</em>
            </>
          }
        />

        <Reveal className="mt-14">
          <div className="overflow-hidden rounded-[28px] bg-white ring-1 ring-line">
            <div className="hidden grid-cols-[0.85fr_1fr_1.05fr] border-b border-line md:grid">
              <div className="px-7 py-4" />
              <div className="px-7 py-4 text-[13px] font-medium text-ink-3">Typical app</div>
              <div className="flex items-center gap-2 bg-leaf-50 px-7 py-4 text-[13px] font-medium text-leaf-800">
                <LogoMark size={18} />
                CalTrack
              </div>
            </div>
            {ROWS.map(([label, usual, ours], i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "0px 0px -8% 0px" }}
                transition={{ duration: 0.6, ease: EASE, delay: i * 0.05 }}
                className="group grid border-b border-line last:border-b-0 md:grid-cols-[0.85fr_1fr_1.05fr]"
              >
                <div className="px-6 pt-5 text-[14px] font-medium text-ink md:px-7 md:py-5">{label}</div>
                <div className="flex items-start gap-3 px-6 pb-2 pt-3 text-[15px] leading-snug text-ink-3 md:px-7 md:py-5">
                  <X size={16} className="mt-[3px] shrink-0 text-ink-3/70" />
                  <span>
                    <span className="mb-0.5 block text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-3/80 md:hidden">Typical app</span>
                    {usual}
                  </span>
                </div>
                <div className="flex items-start gap-3 bg-leaf-50 px-6 py-4 text-[15px] leading-snug text-ink transition-colors duration-300 group-hover:bg-leaf-100/70 md:px-7 md:py-5">
                  <span className="mt-[2px] grid size-[18px] shrink-0 place-items-center rounded-full bg-leaf-500 text-white">
                    <Check size={11} strokeWidth={2.8} />
                  </span>
                  <span>
                    <span className="mb-0.5 block text-[11.5px] font-medium uppercase tracking-[0.08em] text-leaf-700 md:hidden">CalTrack</span>
                    {ours}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
