import { describe, expect, it } from "vitest";
import { defaultThemes, normalizeTheme, parseTheme, safeCssValue, safeThemeMediaUrl } from "../lib/themes";

describe("theme configuration", () => {
  it("falls back to defaults on invalid JSON", () => {
    expect(parseTheme("{broken").background).toBe(defaultThemes[0].settings.background);
    expect(parseTheme("[]").layout).toBe("stack");
  });

  it("rejects CSS injection in theme values", () => {
    expect(safeCssValue("red; background:url(https://evil)", "x")).toBe("x");
    expect(safeCssValue("url(https://evil/x.png)", "x")).toBe("x");
    expect(safeCssValue("#fff}</style><script>", "x")).toBe("x");
    expect(safeCssValue("linear-gradient(160deg, #e4fbff 0%, #fdf7e7 100%)", "x")).toContain("linear-gradient");
  });

  it("only allows local uploads or http(s) for media", () => {
    expect(safeThemeMediaUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeThemeMediaUrl("/uploads/themes/a.png")).toBe("/uploads/themes/a.png");
    expect(safeThemeMediaUrl("/uploads/../../etc/passwd")).toBeUndefined();
    expect(safeThemeMediaUrl("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
  });

  it("clamps numbers and enums", () => {
    const theme = normalizeTheme({ radius: 999, buttonBorderWidth: -3, layout: "weird", backgroundOverlay: 500, hoverEffect: "grow" });
    expect(theme.radius).toBe(40);
    expect(theme.buttonBorderWidth).toBe(0);
    expect(theme.layout).toBe("stack");
    expect(theme.backgroundOverlay).toBe(90);
    expect(theme.hoverEffect).toBe("grow");
  });

  it("keeps every starter theme valid after normalization", () => {
    for (const theme of defaultThemes) {
      const normalized = normalizeTheme(theme.settings);
      expect(normalized.background).toBe(theme.settings.background);
      expect(normalized.shadow).toBe(theme.settings.shadow);
    }
  });
});
