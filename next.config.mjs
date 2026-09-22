/** @type {import('next').NextConfig} */

// Hosts allowed to frame our pages. WaveWarZ runs three surfaces
// (see docs/SURFACES.md), so all three are listed plus Vercel preview builds of
// the intelligence app. Anything not here cannot frame them.
//
// UNTIL 2026-09-22 THIS COVERED /embed/* AND NOTHING ELSE, which had it exactly
// backwards: the read-only analytics were framing-restricted while the surfaces
// that can move money were framable by any site on the internet. Measured
// against the running server that day - /embed/battles carried the header and
// /widget/<id> carried none. A page that connects a wallet and asks for a
// signature is the one that must not sit under somebody else's overlay.
//
// This is a CSP frame-ancestors list, not X-Frame-Options: the latter only
// understands a single origin and would lock out two of the three hosts.
const EMBED_FRAME_ANCESTORS = [
  "'self'",
  "https://wavewarz.info",
  "https://*.wavewarz.info",
  "https://wavewarz.com",
  "https://*.wavewarz.com",
  "https://wavewarz-intelligence.vercel.app",
  "https://*.vercel.app",
].join(" ");

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      // The interactive surfaces: connect a wallet, sign, settle. Framing
      // restricted to our own hosts, with no cache header - these are not
      // edge-cacheable the way a read-only widget is.
      {
        source: "/:path(widget|claim|operator|battle)/:rest*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${EMBED_FRAME_ANCESTORS};`,
          },
        ],
      },
      {
        source: "/:path(claim|operator)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${EMBED_FRAME_ANCESTORS};`,
          },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${EMBED_FRAME_ANCESTORS};`,
          },
          // The gallery copies snippets people paste on other origins, so the
          // widget HTML itself must be cacheable at the edge but never stale for
          // long - the underlying data moves daily at most.
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
