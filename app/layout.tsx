import type { Metadata } from "next";
import "./globals.css";
import { FLOOR_SOL } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL("https://wwtracker.vercel.app"),
  title: "WaveWarZ - on-chain tracker",
  description:
    `On-chain analytics for WaveWarZ — the Solana music-battle platform in The ZAO ecosystem. Treasury balance vs the ${FLOOR_SOL} SOL floor, battles/trades/traders, and trader PnL. Backed by Dune.`,
  keywords: [
    "WaveWarZ", "music battle", "Solana", "prediction market", "on-chain analytics",
    "The ZAO", "ZTalent Artist Organization", "music DAO", "crypto music",
    "artist payouts", "DJ Wavy", "web3 music", "Solana DeFi", "music NFT",
  ],
  authors: [{ name: "Zaal Panthaki", url: "https://x.com/bettercallzaal" }],
  alternates: { canonical: "https://wwtracker.vercel.app" },
  openGraph: {
    title: "WaveWarZ - on-chain tracker",
    description:
      "Treasury balance, program activity, and trader PnL for WaveWarZ — the Solana music-battle platform in The ZAO ecosystem.",
    url: "https://wwtracker.vercel.app",
    siteName: "wwtracker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WaveWarZ - on-chain tracker",
    description:
      "Treasury balance, program activity, and trader PnL for WaveWarZ — a Solana music-battle platform in The ZAO ecosystem.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
