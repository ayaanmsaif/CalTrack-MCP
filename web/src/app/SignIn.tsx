import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "../components/Logo";
import { EASE } from "../components/ui";
import { Alert, Check, GoogleIcon } from "../components/icons";
import { Ring } from "../components/Ring";
import { isConfigured, supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`block size-4 animate-spin rounded-full border-2 ${light ? "border-white/30 border-t-white" : "border-ink/15 border-t-ink"}`}
      aria-hidden="true"
    />
  );
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

const inputCls =
  "h-12 w-full rounded-2xl bg-white px-4 text-[15px] text-ink ring-1 ring-line outline-none transition-[box-shadow] duration-200 placeholder:text-ink-3 focus:ring-2 focus:ring-leaf-500";

export function SignIn() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "google" | "email">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!loading && session) return <Navigate to={from} replace />;

  const signInWithGoogle = async () => {
    setError(null);
    setNotice(null);
    setBusy("google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy("email");

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
      } else {
        navigate(from, { replace: true });
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/app` },
      });
      if (error) {
        setError(error.message);
      } else if (!data.session) {
        setNotice("Check your inbox for a confirmation link, then sign in here.");
        setMode("signin");
        setPassword("");
      } else {
        navigate("/app", { replace: true });
      }
    }
    setBusy(null);
  };

  const switchMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setNotice(null);
  };

  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[1fr_1.05fr]">
      <BrandPanel />

      <main className="flex items-center justify-center px-5 py-12">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="w-full max-w-[400px]">
          <Link to="/" className="inline-block lg:hidden" aria-label="CalTrack home">
            <Logo />
          </Link>

          <div className="relative mt-10 h-[52px] overflow-hidden lg:mt-0">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.h1
                key={mode}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -40, opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="absolute inset-0 font-serif text-[46px] leading-none tracking-[-0.02em] text-ink"
              >
                {mode === "signin" ? (
                  <>
                    Welcome <em className="italic text-leaf-600">back</em>.
                  </>
                ) : (
                  <>
                    Make an <em className="italic text-leaf-600">account</em>.
                  </>
                )}
              </motion.h1>
            </AnimatePresence>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Use the same account you connect to Claude or ChatGPT.</p>

          {!isConfigured ? (
            <div className="mt-8 flex items-start gap-3 rounded-2xl bg-white p-4 text-[14px] text-ink-2 ring-1 ring-line">
              <Alert size={17} className="mt-0.5 shrink-0 text-serious" />
              The dashboard isn't configured yet: the server is missing its Supabase settings.
            </div>
          ) : (
            <>
              <button
                onClick={signInWithGoogle}
                disabled={busy !== null}
                className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white text-[15px] font-medium text-ink ring-1 ring-line transition-[box-shadow,transform] duration-200 hover:ring-ink/20 active:scale-[0.99] disabled:opacity-60"
              >
                {busy === "google" ? <Spinner /> : <GoogleIcon size={18} />}
                Continue with Google
              </button>

              <div className="my-6 flex items-center gap-3 text-[13px] text-ink-3">
                <span className="h-px flex-1 bg-line" />
                or with email
                <span className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={submit} className="space-y-3">
                <label className="block">
                  <span className="sr-only">Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Password</span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    placeholder={mode === "signin" ? "Password" : "Password (at least 6 characters)"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                  />
                </label>

                <AnimatePresence initial={false}>
                  {(error || notice) && (
                    <motion.div
                      key={error ?? notice}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div
                        className={`flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-[14px] ${
                          error ? "bg-[#fdf0ea] text-ink" : "bg-leaf-50 text-ink ring-1 ring-leaf-100"
                        }`}
                        role={error ? "alert" : "status"}
                      >
                        {error ? (
                          <Alert size={16} className="mt-0.5 shrink-0 text-serious" />
                        ) : (
                          <Check size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-leaf-600" />
                        )}
                        {error ?? notice}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={busy !== null}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-white transition-[background-color,transform] duration-200 hover:bg-leaf-800 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy === "email" && <Spinner light />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              <p className="mt-6 text-center text-[14px] text-ink-2">
                {mode === "signin" ? "New to CalTrack?" : "Already have an account?"}{" "}
                <button onClick={switchMode} className="font-medium text-leaf-700 underline-offset-4 hover:underline">
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
