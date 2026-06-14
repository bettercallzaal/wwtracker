import BalanceDashboard from "@/components/BalanceDashboard";

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
      <BalanceDashboard />
    </main>
  );
}
