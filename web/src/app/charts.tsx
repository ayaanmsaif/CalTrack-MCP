import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "../components/ui";
import { fmt1, fmtInt } from "../lib/format";

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceStep(rough: number) {
  const pow = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s >= rough) ?? 10 * pow;
}

export function niceTicks(max: number, count = 4): number[] {
  const step = niceStep(Math.max(max, 1) / count);
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

function niceRange(min: number, max: number, count = 4) {
  const step = niceStep(Math.max(max - min, 0.5) / count);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Number(v.toFixed(6)));
  return { lo, hi, ticks };
}

// Rounded 4px data-end on top, square at the baseline.
function barPath(x: number, yTop: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${yTop + h}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yTop + h}Z`;
}

function TipKey({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px]">
      <span className="flex items-center gap-2 text-ink-2">
        <span className="h-[2px] w-3 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-medium text-ink tnum">{value}</span>
    </div>
  );
}

const TIP_W = 184;

export type ColumnDatum = {
  key: string;
  label: string;
  short: string;
  value: number | null;
  protein: number;
  carbs: number;
  fat: number;
};

export function ColumnChart({ data, target, height = 220 }: { data: ColumnDatum[]; target: number | null; height?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const padL = 46;
  const padR = 8;
  const padT = 18;
  const axisH = 30;
  const plotW = Math.max(width - padL - padR, 0);
  const maxVal = Math.max(target ?? 0, ...data.map((d) => d.value ?? 0));
  const ticks = niceTicks(maxVal * 1.08 || 100, 4);
  const top = ticks[ticks.length - 1];
  const yOf = (v: number) => padT + height - (v / top) * height;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(1, Math.min(24, band - 2));
  const baseY = yOf(0);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 60))));
  const svgH = padT + height + axisH;

  const indexAt = (clientX: number) => {
    const el = ref.current;
    if (!el || band <= 0) return null;
    const i = Math.floor((clientX - el.getBoundingClientRect().left - padL) / band);
    return i >= 0 && i < data.length ? i : null;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => setActive(indexAt(e.clientX));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActive((a) => Math.min((a ?? -1) + 1, data.length - 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((a) => Math.max((a ?? data.length) - 1, 0));
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  const d = active != null ? data[active] : null;
  const tipLeft = active != null ? Math.min(Math.max(padL + band * active + band / 2 - TIP_W / 2, 0), Math.max(width - TIP_W, 0)) : 0;

  return (
    <div
      ref={ref}
      className="relative mt-5 touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-leaf-500/40"
      style={{ height: svgH }}
      tabIndex={0}
      role="group"
      aria-label="Calories per day chart. Use left and right arrow keys to read each day."
      onPointerMove={onPointerMove}
      onPointerLeave={() => setActive(null)}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={svgH} className="block overflow-visible" aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={padL}
                x2={width - padR}
                y1={yOf(t)}
                y2={yOf(t)}
                stroke={t === 0 ? "var(--color-line)" : "var(--color-line-soft)"}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text x={padL - 10} y={yOf(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tnum">
                {fmtInt(t)}
              </text>
            </g>
          ))}

          {active != null && <rect x={padL + band * active} y={padT} width={band} height={height} rx={6} fill="var(--color-leaf-50)" />}

          {data.map((datum, i) =>
            datum.value && datum.value > 0 ? (
              <motion.path
                key={datum.key}
                d={barPath(padL + band * i + (band - barW) / 2, yOf(datum.value), barW, baseY - yOf(datum.value))}
                fill={active === i ? "var(--color-leaf-700)" : "var(--color-leaf-500)"}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.6, ease: EASE, delay: Math.min(i * 0.012, 0.35) }}
                style={{ transformBox: "fill-box", originY: 1 }}
              />
            ) : null
          )}

          {target != null && (
            <g>
              <line
                x1={padL}
                x2={width - padR}
                y1={yOf(target)}
                y2={yOf(target)}
                stroke="var(--color-ink)"
                strokeOpacity={0.5}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={width - padR}
                y={yOf(target) - 6}
                textAnchor="end"
                stroke="#ffffff"
                strokeWidth={4}
                strokeLinejoin="round"
                paintOrder="stroke"
                className="fill-ink-2 text-[11px] tnum"
              >
                Target {fmtInt(target)}
              </text>
            </g>
          )}

          {data.map((datum, i) =>
            (data.length - 1 - i) % labelEvery === 0 ? (
              <text key={datum.key} x={padL + band * i + band / 2} y={padT + height + 20} textAnchor="middle" className="fill-ink-3 text-[11px]">
                {datum.short}
              </text>
            ) : null
          )}
        </svg>
      )}

      <AnimatePresence>
        {d && (
          <motion.div
            key="tip"
            initial={{ opacity: 0, y: 4, x: tipLeft }}
            animate={{ opacity: 1, y: 0, x: tipLeft }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ x: { type: "spring", stiffness: 700, damping: 50 }, opacity: { duration: 0.15 }, y: { duration: 0.15 } }}
            className="pointer-events-none absolute left-0 top-0 z-10 rounded-xl bg-white p-3 shadow-[0_16px_32px_-16px_rgb(13_42_30/0.35)] ring-1 ring-line"
            style={{ width: TIP_W }}
          >
            <div className="text-[12px] text-ink-3">{d.label}</div>
            <div className="mt-0.5 text-[16px] font-semibold text-ink tnum">{d.value ? `${fmtInt(d.value)} kcal` : "Nothing logged"}</div>
            {target != null && d.value ? (
              <div className="text-[12px] text-ink-2 tnum">
                {d.value <= target ? `${fmtInt(target - d.value)} under target` : `${fmtInt(d.value - target)} over target`}
              </div>
            ) : null}
            {d.value ? (
              <div className="mt-2 space-y-1 border-t border-line-soft pt-2">
                <TipKey color="var(--color-protein)" label="Protein" value={`${fmt1(d.protein)} g`} />
                <TipKey color="var(--color-carbs)" label="Carbs" value={`${fmt1(d.carbs)} g`} />
                <TipKey color="var(--color-fat)" label="Fat" value={`${fmt1(d.fat)} g`} />
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export type LinePoint = { t: number; v: number; label: string };

export function LineChart({
  points,
  domain,
  axis,
  unit,
  height = 180,
}: {
  points: LinePoint[];
  domain: [number, number];
  axis: { t: number; label: string }[];
  unit: string;
  height?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const padL = 46;
  const padR = 64;
  const padT = 22;
  const axisH = 28;
  const plotW = Math.max(width - padL - padR, 0);
  const vals = points.map((p) => p.v);
  const { lo, hi, ticks } = niceRange(Math.min(...vals) - 0.3, Math.max(...vals) + 0.3, 4);
  const span = domain[1] - domain[0] || 1;
  const xOf = (t: number) => padL + ((t - domain[0]) / span) * plotW;
  const yOf = (v: number) => padT + height - ((v - lo) / (hi - lo || 1)) * height;
  const svgH = padT + height + axisH;

  const path = points.map((p, i) => `${i ? "L" : "M"}${xOf(p.t).toFixed(1)},${yOf(p.v).toFixed(1)}`).join("");
  const first = points[0];
  const last = points[points.length - 1];
  const area = points.length > 1 ? `${path}L${xOf(last.t).toFixed(1)},${yOf(lo)}L${xOf(first.t).toFixed(1)},${yOf(lo)}Z` : "";
  const showDots = points.length <= 16;

  const nearest = (clientX: number) => {
    const el = ref.current;
    if (!el || points.length === 0) return null;
    const x = clientX - el.getBoundingClientRect().left;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(xOf(p.t) - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActive((a) => Math.min((a ?? -1) + 1, points.length - 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((a) => Math.max((a ?? points.length) - 1, 0));
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  const p = active != null ? points[active] : null;
  const tipLeft = p ? Math.min(Math.max(xOf(p.t) - 70, 0), Math.max(width - 140, 0)) : 0;

  return (
    <div
      ref={ref}
      className="relative mt-5 touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-leaf-500/40"
      style={{ height: svgH }}
      tabIndex={0}
      role="group"
      aria-label="Weight trend chart. Use left and right arrow keys to read each weigh-in."
      onPointerMove={(e) => setActive(nearest(e.clientX))}
      onPointerLeave={() => setActive(null)}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={svgH} className="block overflow-visible" aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={yOf(t)} y2={yOf(t)} stroke="var(--color-line-soft)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={padL - 10} y={yOf(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tnum">
                {fmt1(t)}
              </text>
            </g>
          ))}
          <line x1={padL} x2={width - padR} y1={padT + height} y2={padT + height} stroke="var(--color-line)" strokeWidth={1} shapeRendering="crispEdges" />

          {axis.map((a) => (
            <text key={a.t} x={xOf(a.t)} y={padT + height + 19} textAnchor="middle" className="fill-ink-3 text-[11px]">
              {a.label}
            </text>
          ))}

          {area && <motion.path d={area} fill="var(--color-leaf-500)" fillOpacity={0.1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }} />}
          {points.length > 1 && (
            <motion.path
              key={path}
              d={path}
              fill="none"
              stroke="var(--color-leaf-600)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: EASE }}
            />
          )}

          {p && <line x1={xOf(p.t)} x2={xOf(p.t)} y1={padT} y2={padT + height} stroke="var(--color-ink)" strokeOpacity={0.25} strokeWidth={1} shapeRendering="crispEdges" />}

          {points.map((pt, i) =>
            showDots || i === points.length - 1 || i === active ? (
              <circle key={pt.t} cx={xOf(pt.t)} cy={yOf(pt.v)} r={i === active ? 5 : 4} fill="var(--color-leaf-600)" stroke="#fff" strokeWidth={2} />
            ) : null
          )}

          {last && !p && (
            <text
              x={xOf(last.t) + 10}
              y={yOf(last.v)}
              dy="0.32em"
              textAnchor="start"
              stroke="#ffffff"
              strokeWidth={4}
              strokeLinejoin="round"
              paintOrder="stroke"
              className="fill-ink text-[12px] font-medium tnum"
            >
              {fmt1(last.v)} {unit}
            </text>
          )}
        </svg>
      )}

      <AnimatePresence>
        {p && (
          <motion.div
            key="tip"
            initial={{ opacity: 0, x: tipLeft }}
            animate={{ opacity: 1, x: tipLeft }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ x: { type: "spring", stiffness: 700, damping: 50 }, opacity: { duration: 0.15 } }}
            className="pointer-events-none absolute left-0 top-0 z-10 w-[140px] rounded-xl bg-white px-3 py-2 shadow-[0_16px_32px_-16px_rgb(13_42_30/0.35)] ring-1 ring-line"
          >
            <div className="text-[15px] font-semibold text-ink tnum">
              {fmt1(p.v)} {unit}
            </div>
            <div className="text-[12px] text-ink-3">{p.label}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
