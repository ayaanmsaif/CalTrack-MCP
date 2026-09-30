import { useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "../components/ui";
import { Alert, Check, Download, Trash } from "../components/icons";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";
import { Card, CardHeader } from "./components";

const CONFIRM_WORD = "DELETE";

export function AccountData() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [busy, setBusy] = useState<null | "export" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState("");

  const userId = session?.user.id;

  const downloadEverything = async () => {
    if (!userId) return;
    setError(null);
    setBusy("export");

    try {
      const mine = (table: string, select = "*") => supabase.from(table).select(select).eq("user_id", userId);
      const [profile, goals, history, entries, meals, water, weight] = await Promise.all([
        mine("profile").maybeSingle(),
        mine("goals").maybeSingle(),
        mine("goal_adjustments_log"),
        mine("food_entries", "*, food_entry_ingredients(*)"),
        mine("saved_meals", "*, saved_meal_ingredients(*)"),
        mine("water_logs"),
        mine("weight_logs"),
      ]);

      for (const result of [profile, goals, history, entries, meals, water, weight]) {
        if (result.error) throw new Error(result.error.message);
      }

      const payload = {
        exported_at: new Date().toISOString(),
        account: { id: userId, email: session?.user.email ?? null },
        profile: profile.data ?? null,
        goals: goals.data ?? null,
        goal_history: history.data ?? [],
        food_entries: entries.data ?? [],
        saved_meals: meals.data ?? [],
        water_logs: water.data ?? [],
        weight_logs: weight.data ?? [],
      };

      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `caltrack-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setExported(true);
      window.setTimeout(() => setExported(false), 5000);
    } catch (e) {
      setError(`Couldn't build your export: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const deleteEverything = async () => {
    if (!session) return;
    setError(null);
    setBusy("delete");

    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Something went wrong.");
      }
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (e) {
      setError(`Couldn't delete your account: ${(e as Error).message}`);
      setBusy(null);
    }
  };

  return (
    <Card className="p-5 md:p-6">
      <CardHeader title="Your data" sub="It belongs to you. Take a copy, or remove all of it." />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          onClick={downloadEverything}
          disabled={busy !== null || !userId}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14.5px] font-medium text-white transition-[background-color,transform] duration-200 hover:bg-leaf-800 active:scale-[0.99] disabled:opacity-60"
        >
          {exported ? <Check size={16} strokeWidth={2.4} /> : <Download size={16} />}
          {busy === "export" ? "Preparing…" : exported ? "Downloaded" : "Download my data"}
        </button>
        <p className="text-[13px] leading-relaxed text-ink-3">One JSON file: every meal, ingredient, weigh-in, water log and goal change.</p>
      </div>

      <div className="mt-6 border-t border-line-soft pt-5">
        <AnimatePresence mode="wait" initial={false}>
          {!confirming ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <button
                onClick={() => {
                  setConfirming(true);
                  setError(null);
                }}
                disabled={busy !== null}
                className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 text-[14.5px] font-medium text-[#a8381a] ring-1 ring-[#f0cdbd] transition-[box-shadow,transform] duration-200 hover:ring-[#e2a98f] active:scale-[0.99] disabled:opacity-60"
              >
                <Trash size={16} />
                Delete my account
              </button>
              <p className="text-[13px] leading-relaxed text-ink-3">Removes everything above and signs you out for good.</p>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="rounded-2xl bg-[#fdf0ea] p-4"
            >
              <p className="text-[14px] leading-relaxed text-ink">
                This deletes your meals, saved meals, weigh-ins, water, goals, profile and every AI app connection, then removes your
                sign-in. It cannot be undone. Download a copy first if you want one.
              </p>
              <label className="mt-4 block text-[13px] text-ink-2">
                Type <span className="font-mono font-medium text-ink">{CONFIRM_WORD}</span> to confirm
                <input
                  autoFocus
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  className="mt-2 block h-11 w-full max-w-[220px] rounded-xl bg-white px-3.5 text-[15px] text-ink ring-1 ring-line outline-none transition-[box-shadow] duration-200 focus:ring-2 focus:ring-[#a8381a]"
                  aria-label={`Type ${CONFIRM_WORD} to confirm`}
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                  onClick={deleteEverything}
                  disabled={phrase.trim().toUpperCase() !== CONFIRM_WORD || busy !== null}
                  className="h-11 rounded-full bg-[#a8381a] px-5 text-[14.5px] font-medium text-white transition-[opacity,transform] duration-200 active:scale-[0.99] disabled:opacity-40"
                >
                  {busy === "delete" ? "Deleting…" : "Delete everything"}
                </button>
                <button
                  onClick={() => {
                    setConfirming(false);
                    setPhrase("");
                  }}
                  disabled={busy !== null}
                  className="h-11 rounded-full bg-white px-5 text-[14.5px] font-medium text-ink ring-1 ring-line transition-[box-shadow,transform] duration-200 hover:ring-ink/20 active:scale-[0.99] disabled:opacity-60"
                >
                  Keep my account
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              <div className="mt-4 flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink" role="alert">
                <Alert size={16} className="mt-0.5 shrink-0 text-serious" />
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
