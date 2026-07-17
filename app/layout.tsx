import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wwtracker.vercel.app"),
  title: "WaveWarZ - on-chain tracker",
  description:
    "On-chain analytics for WaveWarZ — the Solana music-battle platform in The ZAO ecosystem. Treasury balance vs the 3.5 SOL floor, battles/trades/traders, and trader PnL. Backed by Dune.",
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
