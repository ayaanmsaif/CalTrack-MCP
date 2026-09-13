import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { Check, Copy } from "./icons";
import { fmtInt } from "../lib/format";

export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Container({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-5 md:px-8 ${className}`}>{children}</div>;
}

export function Reveal({
  children,
  className = "",
  delay = 0,
  y = 22,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.75, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-[12.5px] font-medium uppercase tracking-[0.14em] ${
        light ? "text-leaf-200" : "text-leaf-600"
      }`}
    >
      <span className={`h-px w-5 ${light ? "bg-leaf-300/60" : "bg-leaf-500/50"}`} />
      {children}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  body,
  light = false,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  light?: boolean;
  className?: string;
}) {
  return (
    <Reveal className={`max-w-[46rem] ${className}`}>
      {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
      <h2
        className={`mt-4 font-serif text-[clamp(2.5rem,5.2vw,4.25rem)] leading-[1] tracking-[-0.015em] text-balance [&_em]:italic ${
          light ? "text-white [&_em]:text-lime" : "text-ink [&_em]:text-leaf-600"
        }`}
      >
        {title}
      </h2>
      {body && (
        <p className={`mt-5 max-w-[38rem] text-[17px] leading-relaxed text-pretty ${light ? "text-leaf-100/80" : "text-ink-2"}`}>
          {body}
        </p>
      )}
    </Reveal>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "light" | "outline-light";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-white hover:bg-leaf-800 shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_10px_24px_-12px_rgb(13_42_30/0.6)]",
  secondary: "bg-white text-ink ring-1 ring-line hover:ring-ink/20",
  ghost: "text-ink-2 hover:text-ink hover:bg-ink/[0.04]",
  light: "bg-white text-leaf-950 hover:bg-lime",
  "outline-light": "text-white ring-1 ring-white/25 hover:ring-white/50 hover:bg-white/[0.06]",
};

const BTN_BASE =
  "group relative inline-flex h-11 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[15px] font-medium transition-[background-color,color,box-shadow,transform] duration-300 ease-[var(--ease-soft)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${BTN_BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  to,
  href,
  variant = "primary",
  className = "",
  children,
}: {
  to?: string;
  href?: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  const cls = `${BTN_BASE} ${VARIANTS[variant]} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback(async (text: string) => {
    await copyText(text);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }, []);
  return { copied, copy };
}

// Both labels share one grid cell so the button never changes width when the
// label swaps.
export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  variant = "secondary",
  className = "",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: Variant;
  className?: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <Button variant={variant} className={className} onClick={() => copy(text)} aria-live="polite">
      <span className="relative grid size-4 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={copied ? "check" : "copy"}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
            className="absolute"
          >
            {copied ? <Check size={16} strokeWidth={2.2} /> : <Copy size={16} />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="grid">
        <span className={`col-start-1 row-start-1 transition-opacity duration-200 ${copied ? "opacity-0" : "opacity-100"}`}>{label}</span>
        <span className={`col-start-1 row-start-1 transition-opacity duration-200 ${copied ? "opacity-100" : "opacity-0"}`} aria-hidden={!copied}>
          {copiedLabel}
        </span>
      </span>
    </Button>
  );
}

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

// Animates by writing textContent directly, so counting never re-renders React.
export function AnimatedNumber({
  value,
  from,
  format = fmtInt,
  duration = 0.9,
  className = "",
}: {
  value: number;
  from?: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(from ?? value);
  const ref = useRef<HTMLSpanElement>(null);
  const formatRef = useRef(format);
  formatRef.current = format;

  useMotionValueEvent(mv, "change", (v) => {
    if (ref.current) ref.current.textContent = formatRef.current(v);
  });

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: EASE });
    return () => controls.stop();
  }, [value, reduced, duration, mv]);

  return (
    <span ref={ref} className={className}>
      {format(from ?? value)}
    </span>
  );
}
