import type { Metadata } from "next";
import { LEADERBOARD } from "@/lib/leaderboard";

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const handle = decodeURIComponent(params.handle);
  const lower = handle.toLowerCase();
  const lb = LEADERBOARD.find((a) => a.handle.toLowerCase() === lower);

  if (lb) {
    const title = `${lb.name} (@${lb.handle}) | WaveWarZ Artist`;
    const description =
      `${lb.name} on WaveWarZ — leaderboard #${lb.rank}, ${lb.rec} record (${lb.win}% win rate), ${lb.vol.toFixed(2)} SOL volume. ` +
      `A ZAO ecosystem artist competing on the Solana music-battle platform.`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://wwtracker.vercel.app/artist/${encodeURIComponent(handle)}`,
        siteName: "wwtracker",
        type: "profile",
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  }

  const title = `@${handle} | WaveWarZ Artist`;
  const description = `${handle}'s WaveWarZ battle profile — on-chain stats, Audius tracks, and leaderboard standing in The ZAO ecosystem.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://wwtracker.vercel.app/artist/${encodeURIComponent(handle)}`,
      siteName: "wwtracker",
      type: "profile",
    },
    twitter: { card: "summary", title, description },
  };
}

export default function ArtistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
