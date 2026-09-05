"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { WIDGETS } from "@/components/embeds/Widgets";
import { findEmbed } from "@/lib/embeds";
import { readEmbedOptions, FONTS } from "@/lib/embedTheme";

// One widget, one iframe, no site chrome.
//
// Client-rendered on purpose. These URLs are loaded from other people's pages,
// so the priority is that the frame paints instantly and any slow upstream
// degrades inside our box rather than blocking the host. See the note at the
// top of components/embeds/Widgets.tsx.

function Embed() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = params?.slug ?? "";
  const widget = findEmbed(slug);
  const Widget = WIDGETS[slug];

  const opts = readEmbedOptions(Object.fromEntries(search?.entries() ?? []));

  // An unknown slug is somebody's typo in an iframe src on a page we do not
  // control. Say which slug failed and where the list is, rather than 404ing
  // into a blank box they cannot debug.
  if (!widget || !Widget) {
    return (
      <div
        style={{
          height: "100vh",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: 16,
          background: opts.palette.bg,
          color: opts.palette.mut,
          fontFamily: FONTS.mono,
          fontSize: 11,
          lineHeight: 1.7,
        }}
      >
        <div>
          Unknown widget {slug ? `"${slug}"` : ""}
          <br />
          See wwtracker.vercel.app/embed for the full list
        </div>
      </div>
    );
  }

  return <Widget opts={opts} />;
}

export default function EmbedPage() {
  return (
    <Suspense fallback={null}>
      <Embed />
    </Suspense>
  );
}
