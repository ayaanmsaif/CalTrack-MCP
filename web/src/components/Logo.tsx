// The mark ships as two PNGs in /public: the brand-green one for light
// surfaces, and a white one for dark panels. It is taller than it is wide, so
// size sets the height and the width follows.
export function LogoMark({ size = 28, className = "", light = false }: { size?: number; className?: string; light?: boolean }) {
  return (
    <img
      src={light ? "/logo-light.png" : "/logo.png"}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ height: size }}
      className={`w-auto select-none ${className}`}
    />
  );
}

export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark light={light} />
      <span className={`text-[17px] font-semibold tracking-[-0.02em] ${light ? "text-white" : "text-ink"}`}>CalTrack</span>
    </span>
  );
}
