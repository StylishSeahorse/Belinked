import { describe, expect, it } from "vitest";
import { extractLinkPreviewFromHtml } from "../lib/link-preview";

describe("link preview extraction", () => {
  it("reads spaced metadata attributes and resolves image URLs", () => {
    const preview = extractLinkPreviewFromHtml(
      `
        <html>
          <head>
            <meta property = "og:title" content = "Event Tickets">
            <meta name = "description" content = "A loud night out">
            <meta property = "og:image" content = "/images/poster.jpg">
          </head>
        </html>
      `,
      "https://example.com/events/bass",
      "example.com"
    );

    expect(preview).toEqual({
      title: "Event Tickets",
      description: "A loud night out",
      imageUrl: "https://example.com/images/poster.jpg",
      iconUrl: ""
    });
  });

  it("falls back to JSON-LD and srcset images", () => {
    const jsonLdPreview = extractLinkPreviewFromHtml(
      `
        <html>
          <head><title>Merch</title></head>
          <script type="application/ld+json">
            {"@type":"Product","image":["https://cdn.example.com/merch.webp"]}
          </script>
        </html>
      `,
      "https://example.com/shop",
      "example.com"
    );

    const srcsetPreview = extractLinkPreviewFromHtml(
      `
        <html>
          <head><title>Gallery</title></head>
          <body><img srcset="/small.jpg 480w, /large.jpg 960w" width="800" height="450"></body>
        </html>
      `,
      "https://example.com/gallery",
      "example.com"
    );

    expect(jsonLdPreview.imageUrl).toBe("https://cdn.example.com/merch.webp");
    expect(srcsetPreview.imageUrl).toBe("https://example.com/small.jpg");
  });
});

import { bestIcon } from "../lib/link-preview";

describe("site icon fallback", () => {
  it("prefers the largest apple-touch-icon and skips svg/ico", () => {
    const html = `
      <link rel="icon" href="/favicon.ico">
      <link rel="icon" type="image/svg+xml" href="/icon.svg">
      <link rel="icon" sizes="32x32" href="/icon-32.png">
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-180.png">
      <link rel="apple-touch-icon" sizes="120x120" href="/apple-120.png">`;
    expect(bestIcon(html, "https://example.com/page")).toBe("https://example.com/apple-180.png");
  });

  it("returns empty when only svg/ico icons exist", () => {
    expect(bestIcon('<link rel="icon" href="/favicon.ico"><link rel="icon" href="/i.svg">', "https://example.com")).toBe("");
  });
});
