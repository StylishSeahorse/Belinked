import { describe, expect, it } from "vitest";
import { insertAfter, layoutFromRows, moveItem } from "../lib/ordering";

const groupable = new Set(["a", "b", "c", "d"]);
const canGroup = (id: string) => groupable.has(id);

describe("block layout ordering", () => {
  it("produces dense unique positions", () => {
    const layout = layoutFromRows([["c"], ["a", "b"], ["d"]], ["a", "b", "c", "d"], canGroup);
    expect(layout.map((entry) => entry.position)).toEqual([1, 2, 3, 4]);
    expect(layout.map((entry) => entry.id)).toEqual(["c", "a", "b", "d"]);
    expect(layout.find((entry) => entry.id === "a")?.groupSize).toBe(2);
    expect(layout.find((entry) => entry.id === "b")?.groupSize).toBe(1);
  });

  it("ignores duplicates and unknown ids and appends missing blocks", () => {
    const layout = layoutFromRows([["a", "a"], ["zzz"], ["b"]], ["a", "b", "c"], canGroup);
    expect(layout.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(new Set(layout.map((entry) => entry.position)).size).toBe(3);
  });

  it("refuses to group blocks that cannot share a row and caps rows at three", () => {
    const layout = layoutFromRows([["a", "x"], ["b", "c", "d", "e"]], ["a", "x", "b", "c", "d", "e"], canGroup);
    expect(layout.find((entry) => entry.id === "a")?.groupSize).toBe(1);
    expect(layout.find((entry) => entry.id === "b")?.groupSize).toBe(3);
    expect(layout.map((entry) => entry.id)).toEqual(["a", "x", "b", "c", "d", "e"]);
  });

  it("moves and inserts items", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(insertAfter(["a", "b", "c", "x"], "x", "a")).toEqual(["a", "x", "b", "c"]);
    expect(insertAfter(["a", "b"], "x", "missing")).toEqual(["a", "b", "x"]);
  });
});
