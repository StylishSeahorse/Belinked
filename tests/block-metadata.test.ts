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
    expect(resolveEmbedUrl("https://youtu.be/abc123")).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(resolveEmbedUrl("https://www.youtube.com/watch?v=xyz789")).toBe("https://www.youtube-nocookie.com/embed/xyz789");
    expect(resolveEmbedUrl("https://www.youtube.com/shorts/xyz789abc")).toBe("https://www.youtube-nocookie.com/embed/xyz789abc");
    expect(resolveEmbedUrl("https://vimeo.com/12345")).toBe("https://player.vimeo.com/video/12345?dnt=1");
    expect(resolveEmbedUrl("https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P")).toBe(
      "https://open.spotify.com/embed/track/7ouMYWpwJ422jRcDASZB7P"
    );
  });

  it("supports additional music providers", () => {
    expect(resolveEmbedUrl("https://soundcloud.com/artist/track")).toContain("https://w.soundcloud.com/player/?url=");
    expect(resolveEmbedUrl("https://www.mixcloud.com/dj/set-name/")).toContain("player-widget.mixcloud.com");
    expect(resolveEmbedUrl("https://music.apple.com/us/album/x/123")).toBe("https://embed.music.apple.com/us/album/x/123");
    expect(resolveEmbedUrl("https://podcasts.apple.com/us/podcast/x/id1")).toBe("https://embed.podcasts.apple.com/us/podcast/x/id1");
    expect(resolveEmbedUrl("https://www.twitch.tv/somechannel")).toMatch(/^https:\/\/player\.twitch\.tv\/\?channel=somechannel&parent=/);
  });

  it("rejects malformed ids and non-https URLs", () => {
    expect(resolveEmbedUrl("https://www.youtube.com/watch?v=<script>")).toBeUndefined();
    expect(resolveEmbedUrl("http://www.youtube.com/watch?v=abc123")).toBeUndefined();
    expect(resolveEmbedUrl("https://open.spotify.com/track/../../evil")).toBeUndefined();
    expect(resolveEmbedUrl("https://bandcamp.com/some/other/page")).toBeUndefined();
  });

  it("rejects unsupported iframe hosts", () => {
    expect(resolveEmbedUrl("https://example.com/embed.html")).toBeUndefined();
    expect(resolveEmbedUrl("javascript:alert(1)")).toBeUndefined();
  });
});
