import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv } from "../lib/csv";

describe("CSV", () => {
  it("parses quoted fields, escaped quotes and CRLF", () => {
    expect(parseCsv('title,url\r\n"Hello, world","https://a.com"\r\n"Say ""hi""",https://b.com\n')).toEqual([
      ["title", "url"],
      ["Hello, world", "https://a.com"],
      ['Say "hi"', "https://b.com"]
    ]);
  });

  it("neutralizes spreadsheet formulas on export", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(toCsv([{ a: "+1", b: "ok" }])).toBe(`a,b\n"'+1","ok"`);
  });
});
