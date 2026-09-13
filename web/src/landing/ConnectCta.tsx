import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ButtonLink, Container, EASE, Reveal, SectionHeader, useCopy } from "../components/ui";
import { ArrowRight, Check, Copy } from "../components/icons";
import { Logo } from "../components/Logo";
import { mcpUrl } from "../config";

function UrlField() {
  const { copied, copy } = useCopy();
  return (
    <button
      onClick={() => copy(mcpUrl)}
      className="group flex w-full items-center gap-3 rounded-2xl bg-white/[0.06] py-3 pl-4 pr-3 text-left ring-1 ring-white/15 transition-[box-shadow,background-color] duration-300 hover:bg-white/[0.09] hover:ring-white/30"
      aria-label="Copy connector URL"
    >
      <span className="min-w-0 flex-1 truncate font-mono text-[13.5px] text-white">{mcpUrl}</span>
      <span className="relative grid size-8 shrink-0 place-items-center rounded-xl bg-white/10 text-white">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={copied ? "y" : "n"}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
            className="absolute"
          >
            {copied ? <Check size={16} strokeWidth={2.4} className="text-lime" /> : <Copy size={16} />}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

export function ConnectCta() {
  const steps = [
    {
      title: "Copy your connector URL",
      body: <UrlField />,
    },
    {
      title: "Add it to your AI",
      body: (
        <p>
          In Claude, open <span className="text-white">Settings → Connectors</span> and add a custom connector. In ChatGPT, turn
          on developer mode and create a connector with the same URL.
        </p>
      ),
    },
    {
      title: "Sign in, then say what you ate",
      body: (
        <p>
          Use Google or GitHub. Then try something like <span className="text-white">“porridge with a banana for breakfast”</span>.
        </p>
      ),
    },
  ];

  return (
    <section id="connect" className="scroll-mt-16 px-3 pb-3 md:px-5 md:pb-5">
      <div className="relative overflow-hidden rounded-[36px] bg-leaf-950 py-20 md:py-28">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -right-40 -top-40 size-[620px] rounded-full animate-drift [background:radial-gradient(closest-side,rgb(23_145_79/0.45),transparent)]" />
          <div className="absolute -bottom-52 -left-32 size-[560px] rounded-full animate-drift [animation-delay:-9s] [background:radial-gradient(closest-side,rgb(217_249_157/0.14),transparent)]" />
          <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.06)_1px,transparent_0)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
        </div>

        <Container className="relative">
          <SectionHeader
            light
            eyebrow="Get started"
            title={
              <>
                Set it up before your <em>next meal</em>.
              </>
            }
            body="Works with any Claude or ChatGPT plan that lets you add custom connectors."
          />

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08} className="rounded-[24px] bg-white/[0.04] p-6 ring-1 ring-white/10 backdrop-blur-sm">
                <span className="font-mono text-[12.5px] text-lime/80">0{i + 1}</span>
                <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.01em] text-white">{s.title}</h3>
                <div className="mt-3 text-[15px] leading-relaxed text-leaf-100/70">{s.body}</div>
              </Reveal>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <ButtonLink to="/app" variant="light" className="h-12 px-6 text-[15.5px]">
              Open the dashboard
              <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink href="#how" variant="outline-light" className="h-12 px-6 text-[15.5px]">
              How it works
            </ButtonLink>
          </motion.div>
        </Container>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="py-10">
      <Container className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-[13px] text-ink-3">© {new Date().getFullYear()}</span>
        </div>
        <p className="text-[13px] text-ink-3">Nutrition figures are estimates, not medical advice.</p>
        <nav className="flex gap-5 text-[13.5px] text-ink-2">
          <a href="#how" className="transition-colors hover:text-ink">
            How it works
          </a>
          <a href="#features" className="transition-colors hover:text-ink">
            Features
          </a>
          <Link to="/app" className="transition-colors hover:text-ink">
            Dashboard
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
