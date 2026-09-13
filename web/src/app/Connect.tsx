import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CopyButton, EASE } from "../components/ui";
import { Info } from "../components/icons";
import { mcpUrl } from "../config";
import { useAuth } from "./AuthProvider";
import { Card, CardHeader, PageHeader, PromptChip, Segmented } from "./components";

type Tab = "claude" | "chatgpt" | "other";

const STEPS: Record<Tab, string[]> = {
  claude: [
    "Open Settings, then Connectors.",
    "Choose “Add custom connector”. Name it CalTrack and paste the URL above.",
    "Click Connect, sign in, and approve access.",
    "In a new chat, make sure CalTrack is switched on in the tools menu, then tell it what you ate.",
  ],
  chatgpt: [
    "Open Settings → Apps & Connectors → Advanced, and turn on developer mode.",
    "Create a new connector. Name it CalTrack, paste the URL above and choose OAuth for authentication.",
    "Sign in and approve access when asked.",
    "Start a chat, add CalTrack from the tools menu, and tell it what you ate.",
  ],
  other: [
    "Look for the option to add a remote MCP server. Some apps call it a custom connector or integration.",
    "Paste the URL above. CalTrack uses OAuth with dynamic client registration, so there's no API key to copy.",
    "Sign in when your app opens the CalTrack login page.",
  ],
};

const PROMPTS = [
  "I had porridge with a banana for breakfast",
  "What's left for today?",
  "Save that as my usual breakfast",
  "Weighed in at 80.2 kg",
  "How was my protein this week?",
  "Set my timezone to Europe/London",
];

export function Connect() {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("claude");

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Setup" title="Connect your AI" />

      <Card className="p-5 md:p-6">
        <CardHeader title="Your connector URL" sub="Paste this into your AI app when you add CalTrack." />
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <div className="flex h-11 min-w-0 items-center rounded-full bg-paper px-4 ring-1 ring-line sm:flex-1">
            <span className="truncate font-mono text-[13.5px] text-ink">{mcpUrl}</span>
          </div>
          <CopyButton text={mcpUrl} label="Copy URL" variant="primary" />
        </div>
        {session?.user.email && (
          <p className="mt-4 flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
            <Info size={16} className="mt-[3px] shrink-0 text-leaf-600" />
            <span>
              When you're asked to sign in, use <span className="font-medium text-ink">{session.user.email}</span>. That's the account
              this dashboard shows, so your meals land in the right place.
            </span>
          </p>
        )}
      </Card>

      <Card className="p-5 md:p-6">
        <Segmented
          id="connect-app"
          label="Choose your AI app"
          value={tab}
          onChange={setTab}
          options={[
            { value: "claude", label: "Claude" },
            { value: "chatgpt", label: "ChatGPT" },
            { value: "other", label: "Other apps" },
          ]}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.ol
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="mt-6 space-y-4"
          >
            {STEPS[tab].map((step, i) => (
              <li key={step} className="flex gap-3.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-leaf-50 font-mono text-[12.5px] font-medium text-leaf-700 ring-1 ring-leaf-100">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-[15px] leading-relaxed text-ink">{step}</span>
              </li>
            ))}
          </motion.ol>
        </AnimatePresence>
        <p className="mt-6 text-[12.5px] text-ink-3">These apps rename their menus now and then, so yours might be labelled a little differently.</p>
      </Card>

      <Card className="p-5 md:p-6">
        <CardHeader title="Then try saying" sub="Tap one to copy it." />
        <div className="mt-4 flex flex-wrap gap-2">
          {PROMPTS.map((p) => (
            <PromptChip key={p} text={p} />
          ))}
        </div>
      </Card>
    </div>
  );
}
