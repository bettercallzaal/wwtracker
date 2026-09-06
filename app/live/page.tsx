import type { Metadata } from "next";
import LiveBattlePositions from "@/components/LiveBattlePositions";

export const metadata: Metadata = {
  title: "Live battle positions - wwtracker",
  description:
    "Who holds what, on which side, while a WaveWarZ battle runs. Read directly from Solana - side balance, holder count, position sizes and the implied payout if each side wins.",
  openGraph: {
    title: "Live battle positions",
    description:
      "Side balance, holders and position sizes during a WaveWarZ battle, read straight from the chain.",
    url: "https://wwtracker.vercel.app/live",
    siteName: "wwtracker",
    type: "website",
  },
};

export default function LivePage() {
  return <LiveBattlePositions />;
}
