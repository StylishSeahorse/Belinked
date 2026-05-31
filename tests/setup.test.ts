import { describe, expect, it } from "vitest";
import { ownerSeedFromEnv, setupDefaultsFromEnv } from "../lib/setup";

describe("setup env helpers", () => {
  it("uses setup env values as form defaults", () => {
    expect(
      setupDefaultsFromEnv({
        SETUP_EMAIL: " owner@example.com ",
        SETUP_DISPLAY_NAME: " Local Owner "
      })
    ).toEqual({
      email: "owner@example.com",
      displayName: "Local Owner"
    });
  });

  it("does not seed an owner unless explicitly enabled", () => {
    expect(
      ownerSeedFromEnv({
        SETUP_EMAIL: "owner@example.com",
        SETUP_PASSWORD: "change-this-password",
        SETUP_DISPLAY_NAME: "Local Owner"
      })
    ).toBeNull();
  });

  it("seeds an owner when auto creation is enabled", () => {
    expect(
      ownerSeedFromEnv({
        BELINKED_AUTO_CREATE_OWNER: "true",
        SETUP_EMAIL: "owner@example.com",
        SETUP_PASSWORD: "change-this-password",
        SETUP_DISPLAY_NAME: "Local Owner"
      })
    ).toEqual({
      email: "owner@example.com",
      password: "change-this-password",
      displayName: "Local Owner"
    });
  });
});
