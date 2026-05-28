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
      imageUrl: "https://example.com/images/poster.jpg"
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
