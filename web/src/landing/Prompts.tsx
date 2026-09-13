import { Container, SectionHeader } from "../components/ui";

const ROW_A: [string, string][] = [
  ["What's left for today?", "get_goal_progress"],
  ["Log my usual oats, but a double", "log_saved_meal"],
  ["What did I eat last Sunday?", "get_meals_by_date"],
  ["Save this as post-gym shake", "create_saved_meal"],
  ["How's my weight looking this month?", "get_weight_trends"],
  ["Actually that was dinner, not lunch", "update_food_entry"],
  ["I drank 500 ml of water", "log_water"],
  ["When did I last have salmon?", "search_meals"],
];

const ROW_B: [string, string][] = [
  ["Weighed in at 81.4 kg this morning", "log_weight"],
  ["Set my goal to lose half a kilo a week", "set_goals"],
  ["Average protein over the last two weeks?", "get_nutrition_summary"],
  ["Remove the biscuits from earlier", "delete_food_entry"],
  ["I've just landed in New York", "set_timezone"],
  ["Look up this barcode for me", "lookup_barcode"],
  ["Lock my calories at 2,000", "set_calorie_override"],
  ["Show me my saved meals", "list_saved_meals"],
];

function Chip({ text, tool, hidden }: { text: string; tool: string; hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden}
      className="flex shrink-0 items-center gap-3 rounded-full bg-white py-2.5 pl-5 pr-2.5 ring-1 ring-line transition-shadow duration-300 hover:shadow-[0_12px_24px_-16px_rgb(13_42_30/0.4)]"
    >
      <span className="whitespace-nowrap text-[15.5px] text-ink">“{text}”</span>
      <span className="whitespace-nowrap rounded-full bg-leaf-50 px-2.5 py-1 font-mono text-[11.5px] text-leaf-700 ring-1 ring-leaf-100">
        {tool}
      </span>
    </div>
  );
}

function MarqueeRow({ items, reverse = false }: { items: [string, string][]; reverse?: boolean }) {
  return (
    <div className="group flex overflow-hidden mask-fade-x">
      <div
        className={`flex shrink-0 gap-3 pr-3 will-change-transform group-hover:[animation-play-state:paused] ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        }`}
      >
        {[...items, ...items].map(([text, tool], i) => (
          <Chip key={i} text={text} tool={tool} hidden={i >= items.length} />
        ))}
      </div>
    </div>
  );
}

export function Prompts() {
  return (
    <section className="overflow-hidden py-24 md:py-32">
      <Container>
        <SectionHeader
          eyebrow="In practice"
          title={
            <>
              A few things you can <em>say</em>.
            </>
          }
          body="Each one maps to a real tool on the CalTrack server, so your AI does the logging for real instead of improvising."
        />
      </Container>
      <div className="mt-14 space-y-3">
        <MarqueeRow items={ROW_A} />
        <MarqueeRow items={ROW_B} reverse />
      </div>
    </section>
  );
}
