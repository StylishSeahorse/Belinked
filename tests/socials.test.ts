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
