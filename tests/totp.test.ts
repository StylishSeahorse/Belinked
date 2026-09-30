import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpCode, verifyTotp } from "../lib/totp";

// RFC 6238 test secret "12345678901234567890" (ASCII), SHA-1.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("matches RFC 6238 test vectors", () => {
    expect(totpCode(RFC_SECRET, 59_000)).toBe("287082");
    expect(totpCode(RFC_SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totpCode(RFC_SECRET, 2_000_000_000_000)).toBe("279037");
  });

  it("round-trips base32", () => {
    const secret = generateTotpSecret();
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it("accepts adjacent steps and rejects garbage", () => {
    const at = 1_700_000_000_000;
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, at - 30_000), at)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, at - 120_000), at)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef", at)).toBe(false);
  });
});
