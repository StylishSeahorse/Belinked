import { describe, expect, it } from "vitest";
import { imageDimensions } from "../lib/uploads";

describe("image dimension parsing", () => {
  it("reads PNG and GIF headers", () => {
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);
    expect(imageDimensions(png, "image/png")).toEqual({ width: 640, height: 480 });

    const gif = Buffer.from("GIF89a\x20\x03\x58\x02", "latin1");
    expect(imageDimensions(gif, "image/gif")).toEqual({ width: 800, height: 600 });
  });

  it("reads JPEG SOF markers", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x90, 0x03]);
    expect(imageDimensions(jpeg, "image/jpeg")).toEqual({ width: 400, height: 300 });
  });

  it("returns null for truncated data", () => {
    expect(imageDimensions(Buffer.from([0xff, 0xd8]), "image/jpeg")).toBeNull();
  });
});
