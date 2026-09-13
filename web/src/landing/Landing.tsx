import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { Problem } from "./Problem";
import { HowItWorks } from "./HowItWorks";
import { Features } from "./Features";
import { Prompts } from "./Prompts";
import { Compare } from "./Compare";
import { DashboardTeaser } from "./DashboardTeaser";
import { ConnectCta, Footer } from "./ConnectCta";

export function Landing() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-paper">
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <Prompts />
        <Compare />
        <DashboardTeaser />
        <ConnectCta />
      </main>
      <Footer />
    </div>
  );
}
