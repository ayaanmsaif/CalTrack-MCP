import type { ReactNode } from "react";
import { motion } from "motion/react";
import { EASE } from "./ui";

// A progress meter: the fill carries the state, the track is a lighter step of
// the same ramp. Past 100%, the overflow draws in the status color on top,
// separated from the base arc by a surface-colored ring.
export function Ring({
  size,
  stroke,
  ratio,
  track = "var(--color-leaf-100)",
  color = "var(--color-leaf-500)",
  overColor = "var(--color-serious)",
  surface = "#ffffff",
  delay = 0,
  className = "",
  children,
}: {
  size: number;
  stroke: number;
  ratio: number;
  track?: string;
  color?: string;
  overColor?: string;
  surface?: string;
  delay?: number;
  className?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const safe = Number.isFinite(ratio) ? Math.max(0, ratio) : 0;
  const main = Math.min(safe, 1);
  const over = Math.min(Math.max(safe - 1, 0), 1);
  const transition = { duration: 1.1, ease: EASE, delay };

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: main, opacity: main > 0.001 ? 1 : 0 }}
          transition={transition}
        />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={surface}
          strokeWidth={stroke + 4}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: over, opacity: over > 0.001 ? 1 : 0 }}
          transition={{ ...transition, delay: delay + 0.45 }}
        />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={overColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: over, opacity: over > 0.001 ? 1 : 0 }}
          transition={{ ...transition, delay: delay + 0.45 }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
