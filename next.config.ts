import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const isHttps = (process.env.APP_URL || "").startsWith("https://") || ["1", "true", "yes", "on"].includes((process.env.COOKIE_SECURE || "").toLowerCase());

// Only these embed players may be framed; must match lib/block-metadata.ts resolveEmbed().
const frameSources = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://open.spotify.com",
  "https://w.soundcloud.com",
  "https://player-widget.mixcloud.com",
  "https://embed.music.apple.com",
  "https://embed.podcasts.apple.com",
  "https://player.twitch.tv",
  "https://bandcamp.com"
];

// Next.js injects inline bootstrap scripts, so 'unsafe-inline' is required for scripts
// without a nonce pipeline. The policy still blocks plugins, foreign framing of this site,
// <base> hijacking, form posts to other origins, and iframes outside the embed allow-list.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: http: data: blob:",
  "media-src 'self' https: http: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  `frame-src ${frameSources.join(" ")}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isHttps ? ["upgrade-insecure-requests"] : [])
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // Uploads go through server actions, whose default 1MB body limit rejects most
    // photos. Per-file limits (UPLOAD_MAX_MB, VIDEO_UPLOAD_MAX_MB, backups) are still
    // enforced in lib/uploads.ts and the restore action.
    serverActions: { bodySizeLimit: "60mb" }
  },
  images: {
    remotePatterns: []
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : [])
        ]
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" }
        ]
      },
      {
        // Uploaded media is served inert: no scripts even if a file were misidentified.
        source: "/uploads/:path*",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; media-src 'self'; sandbox" }]
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
      }
    ];
  }
};

export default nextConfig;
