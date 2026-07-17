import AppShell from "@/components/AppShell";
import FreshnessBanner from "@/components/FreshnessBanner";
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
      <RecentBattlesFeed />
      <AppShell />
    </main>
  );
}
