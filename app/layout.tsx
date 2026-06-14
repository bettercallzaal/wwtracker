import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WaveWarZ - Dev Wallet Balance",
  description:
    "Daily end-of-day SOL balance for the WaveWarZ dev wallet, climbing toward the 3.5 SOL operating floor. Backed by a Dune query.",
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
