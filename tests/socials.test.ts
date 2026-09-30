import { describe, expect, it } from "vitest";
import { parseSocialPlacement, socialLabelForIcon } from "../lib/socials";

describe("social settings", () => {
  it("parses supported placements", () => {
    expect(parseSocialPlacement("top")).toBe("top");
    expect(parseSocialPlacement("bottom")).toBe("bottom");
    expect(parseSocialPlacement("else")).toBe("top");
  });

  it("maps known icon names to readable labels", () => {
    expect(socialLabelForIcon("instagram")).toBe("Instagram");
    expect(socialLabelForIcon("website")).toBe("Website");
  });
});

import { detectSocialPlatform, normalizeSocialUrl, socialPlatforms } from "../lib/socials";

describe("social platform registry", () => {
  it("detects platforms from URLs, emails and phone numbers", () => {
    expect(detectSocialPlatform("https://www.instagram.com/me")).toBe("instagram");
    expect(detectSocialPlatform("https://bsky.app/profile/me.bsky.social")).toBe("bluesky");
    expect(detectSocialPlatform("https://x.com/me")).toBe("x");
    expect(detectSocialPlatform("hello@example.com")).toBe("email");
    expect(detectSocialPlatform("tel:+15551234567")).toBe("phone");
    expect(detectSocialPlatform("https://my-site.example")).toBeUndefined();
  });

  it("normalizes email and phone into safe hrefs", () => {
    expect(normalizeSocialUrl("email", "hello@example.com")).toBe("mailto:hello@example.com");
    expect(normalizeSocialUrl("phone", "+1 (555) 123-4567")).toBe("tel:+15551234567");
    expect(normalizeSocialUrl("instagram", " https://instagram.com/me ")).toBe("https://instagram.com/me");
  });

  it("covers the required platforms with unique ids", () => {
    const ids = socialPlatforms.map((platform) => platform.id);
    for (const required of ["instagram", "tiktok", "youtube", "facebook", "x", "twitch", "discord", "spotify", "soundcloud", "linkedin", "github", "threads", "snapchat", "pinterest", "bluesky", "telegram", "whatsapp", "email", "phone", "website"]) {
      expect(ids).toContain(required);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
