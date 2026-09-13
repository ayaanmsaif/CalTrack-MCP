import { useEffect, useState, type ComponentType } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "../components/Logo";
import { EASE } from "../components/ui";
import { Alert, GitHubIcon, GoogleIcon } from "../components/icons";
import { Ring } from "../components/Ring";
import { isConfigured, supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";

type Provider = "google" | "github";

const PROVIDERS: { id: Provider; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "github", label: "GitHub", Icon: GitHubIcon },
];

function Spinner() {
  return <span className="block size-4 animate-spin rounded-full border-2 border-ink/15 border-t-ink" aria-hidden="true" />;
}

function BrandPanel() {
  const lines = ["Porridge with a banana and a spoon of honey", "Same lunch as Tuesday", "What's left for today?"];
  return (
    <aside className="relative hidden overflow-hidden bg-leaf-950 p-10 lg:flex lg:flex-col lg:justify-between">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 -top-32 size-[560px] rounded-full animate-drift [background:radial-gradient(closest-side,rgb(23_145_79/0.5),transparent)]" />
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.06)_1px,transparent_0)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      </div>

      <Link to="/" className="relative" aria-label="CalTrack home">
        <Logo light />
      </Link>

      <div className="relative">
        <h2 className="max-w-[26rem] font-serif text-[52px] leading-[0.98] tracking-[-0.02em] text-white">
          Your food log, <em className="italic text-lime">one sentence</em> at a time.
        </h2>
        <div className="mt-10 space-y-2.5">
          {lines.map((l, i) => (
            <motion.div
              key={l}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.4 + i * 0.18 }}
              className="w-fit rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-2.5 text-[15px] text-leaf-50 ring-1 ring-white/10"
            >
              {l}
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.1 }}
          className="mt-8 flex w-fit items-center gap-3 rounded-2xl bg-white py-2.5 pl-2.5 pr-4"
        >
          <Ring size={42} stroke={5} ratio={0.62} delay={1.2} />
          <div className="leading-tight">
            <div className="text-[14.5px] font-semibold text-ink">798 kcal left</div>
            <div className="text-[12px] text-ink-3">of 2,100 today</div>
          </div>
        </motion.div>
      </div>

      <p className="relative text-[13px] text-leaf-100/50">Nutrition figures are estimates, not medical advice.</p>
    </aside>
  );
}

export function SignIn() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Coming back with the browser's Back button restores this page from the
  // back/forward cache with the spinner still showing. Reset it.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (!loading && session) return <Navigate to={from} replace />;

  const signIn = async (provider: Provider) => {
    setError(null);
    setBusy(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/app`,
        // Always show the provider's account chooser, so switching accounts
        // works instead of silently reusing whichever account the browser is
        // already signed in to.
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  };

  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[1fr_1.05fr]">
      <BrandPanel />

      <main className="flex items-center justify-center px-5 py-12">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="w-full max-w-[400px]">
          <Link to="/" className="inline-block lg:hidden" aria-label="CalTrack home">
            <Logo />
          </Link>

          <h1 className="mt-10 font-serif text-[46px] leading-none tracking-[-0.02em] text-balance text-ink lg:mt-0">
            Sign in to <em className="italic text-leaf-600">CalTrack</em>.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            New here? Signing in creates your account. Use the same one you connect to Claude or ChatGPT.
          </p>

          {!isConfigured ? (
            <div className="mt-8 flex items-start gap-3 rounded-2xl bg-white p-4 text-[14px] text-ink-2 ring-1 ring-line">
              <Alert size={17} className="mt-0.5 shrink-0 text-serious" />
              The dashboard isn't configured yet: the server is missing its Supabase settings.
            </div>
          ) : (
            <>
              <div className="mt-8 space-y-3">
                {PROVIDERS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => signIn(id)}
                    disabled={busy !== null}
                    className="flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white text-[15px] font-medium text-ink ring-1 ring-line transition-[box-shadow,transform] duration-200 hover:ring-ink/20 active:scale-[0.99] disabled:opacity-60"
                  >
                    {busy === id ? <Spinner /> : <Icon size={18} />}
                    Continue with {label}
                  </button>
                ))}
              </div>

              <AnimatePresence initial={false}>
                {error && (
                  <motion.div
                    key={error}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-[#fdf0ea] px-3.5 py-3 text-[14px] text-ink" role="alert">
                      <Alert size={16} className="mt-0.5 shrink-0 text-serious" />
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mt-8 text-center text-[13px] leading-relaxed text-ink-3">CalTrack never sees your Google or GitHub password.</p>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
