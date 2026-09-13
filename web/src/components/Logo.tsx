export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="9" fill="#17914f" />
      <path
        d="M7 23.2c2.9-.5 5.4-1.3 8-2.7 3.2-1.8 5.8-4.4 8-8"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M19.4 10.2 25.6 8l-1.3 6.4z" fill="#fff" />
      <circle cx="11" cy="22.2" r="2.1" fill="#fff" />
      <circle cx="18" cy="18.6" r="2.1" fill="#fff" />
    </svg>
  );
}

export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className={`text-[17px] font-semibold tracking-[-0.02em] ${light ? "text-white" : "text-ink"}`}>CalTrack</span>
    </span>
  );
}
