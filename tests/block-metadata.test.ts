import { describe, expect, it } from "vitest";
import { parseBlockMetadata, resolveEmbedUrl } from "../lib/block-metadata";

describe("block metadata", () => {
  it("parses valid metadata and ignores invalid json", () => {
    expect(parseBlockMetadata('{"price":"$20","buttonLabel":"Shop now"}')).toEqual({
      price: "$20",
      buttonLabel: "Shop now"
    });
    expect(parseBlockMetadata("{not-json")).toEqual({});
  });

  it("normalizes common embed providers", () => {
    expect(resolveEmbedUrl("https://youtu.be/abc123")).toBe("https://www.youtube.com/embed/abc123");
    expect(resolveEmbedUrl("https://www.youtube.com/watch?v=xyz789")).toBe("https://www.youtube.com/embed/xyz789");
    expect(resolveEmbedUrl("https://vimeo.com/12345")).toBe("https://player.vimeo.com/video/12345");
    expect(resolveEmbedUrl("https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P")).toBe(
      "https://open.spotify.com/embed/track/7ouMYWpwJ422jRcDASZB7P"
    );
  });
});
