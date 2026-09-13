import type { ComponentType } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "../components/Logo";
import { EASE } from "../components/ui";
import { Bookmark, CalendarIcon, LogOut, Plug, Target, TrendUp } from "../components/icons";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";

type NavItem = { to: string; label: string; short: string; icon: ComponentType<{ size?: number; className?: string }>; end?: boolean };

const NAV: NavItem[] = [
  { to: "/app", label: "Today", short: "Today", icon: CalendarIcon, end: true },
  { to: "/app/trends", label: "Trends", short: "Trends", icon: TrendUp },
  { to: "/app/meals", label: "Saved meals", short: "Meals", icon: Bookmark },
  { to: "/app/goals", label: "Goals", short: "Goals", icon: Target },
  { to: "/app/connect", label: "Connect", short: "Connect", icon: Plug },
];

function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate("/app/signin", { replace: true });
  };
}

export function AppShell() {
  const { session } = useAuth();
  const location = useLocation();
  const signOut = useSignOut();
  const email = session?.user.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "·";

  return (
    <div className="min-h-dvh bg-paper">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-paper px-3 py-5 lg:flex">
        <Link to="/" className="px-3 py-1" aria-label="CalTrack home">
          <Logo />
        </Link>
        <nav className="mt-8 space-y-0.5" aria-label="Dashboard">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="block">
              {({ isActive }) => (
                <span
                  className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors duration-200 ${
                    isActive ? "font-medium text-ink" : "text-ink-2 hover:bg-ink/[0.035] hover:text-ink"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgb(13_42_30/0.06)] ring-1 ring-line"
                      transition={{ type: "spring", stiffness: 500, damping: 42 }}
                    />
                  )}
                  <item.icon size={18} className={`relative ${isActive ? "text-leaf-600" : ""}`} />
                  <span className="relative">{item.label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl p-2">
          <div className="flex items-center gap-3 px-1">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-leaf-100 text-[13px] font-semibold text-leaf-800">{initial}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2" title={email}>
              {email}
            </span>
          </div>
          <button
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-ink-2 transition-colors duration-200 hover:bg-ink/[0.035] hover:text-ink"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-paper/85 px-4 backdrop-blur-xl lg:hidden">
        <Link to="/" aria-label="CalTrack home">
          <Logo />
        </Link>
        <button
          onClick={signOut}
          aria-label="Sign out"
          className="grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-ink/[0.05] hover:text-ink"
        >
          <LogOut size={18} />
        </button>
      </header>

      <main className="lg:pl-[248px]">
        <div className="mx-auto w-full max-w-[1080px] px-4 pb-32 pt-6 md:px-8 md:pt-10 lg:pb-16">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
            <Outlet />
          </motion.div>
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-[520px] grid-cols-5">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {({ isActive }) => (
                <span className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${isActive ? "text-leaf-700" : "text-ink-3"}`}>
                  {isActive && (
                    <motion.span layoutId="tab-active" className="absolute top-0 h-[2px] w-8 rounded-full bg-leaf-500" transition={{ type: "spring", stiffness: 500, damping: 42 }} />
                  )}
                  <item.icon size={20} />
                  {item.short}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
