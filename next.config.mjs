/** @type {import('next').NextConfig} */

// Hosts allowed to put /embed/* in an iframe. WaveWarZ runs three surfaces
// (see docs/SURFACES.md), so all three are listed plus Vercel preview builds of
// the intelligence app. Anything not here cannot frame the widgets.
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
