import AppShell from "@/components/AppShell";
import FreshnessBanner from "@/components/FreshnessBanner";
import LiveTicker from "@/components/LiveTicker";
import RecentBattlesFeed from "@/components/RecentBattlesFeed";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "clamp(16px, 4vw, 48px)",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <FreshnessBanner />
      <LiveTicker />
      <RecentBattlesFeed />
      <AppShell />
    </main>
  );
}
