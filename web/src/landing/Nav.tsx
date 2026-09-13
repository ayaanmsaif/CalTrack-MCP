import { useState } from "react";
import { Link } from "react-router";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { Logo } from "../components/Logo";
import { ButtonLink, Container, EASE } from "../components/ui";
import { ArrowRight } from "../components/icons";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#compare", label: "Compare" },
];

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 16));

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div
        className={`border-b transition-[background-color,border-color,backdrop-filter] duration-500 ${
          scrolled ? "border-line/80 bg-paper/80 backdrop-blur-xl" : "border-transparent bg-transparent"
        }`}
      >
        <Container className="flex h-16 items-center justify-between gap-4">
          <a href="#top" aria-label="CalTrack home">
            <Logo />
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-3.5 py-2 text-[14.5px] text-ink-2 transition-colors duration-300 hover:bg-ink/[0.04] hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <Link
              to="/app"
              className="rounded-full px-3.5 py-2 text-[14.5px] text-ink-2 transition-colors duration-300 hover:bg-ink/[0.04] hover:text-ink"
            >
              Sign in
            </Link>
            <ButtonLink href="#connect" className="h-10 px-4 text-[14.5px]">
              Get started
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </ButtonLink>
          </div>
        </Container>
      </div>
    </motion.header>
  );
}
