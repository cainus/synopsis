import { describe, it, expect } from "vitest";
import { diffClass, diffBg } from "./diffStyles";

describe("diffClass", () => {
  it("returns green styling for added lines", () => {
    expect(diffClass("+added")).toBe("text-green-500 bg-green-500/8");
  });

  it("returns red styling for removed lines", () => {
    expect(diffClass("-removed")).toBe("text-red-400 bg-red-400/8");
  });

  it("returns empty string for hunk headers (no longer styled, filtered out before rendering)", () => {
    expect(diffClass("@@ -343,15 +336,103 @@ export class MessageThread {")).toBe("");
  });

  it("returns empty string for context lines", () => {
    expect(diffClass(" context")).toBe("");
  });
});

describe("diffBg", () => {
  it("returns green bg for added lines", () => {
    expect(diffBg("+added")).toBe("bg-green-500/8");
  });

  it("returns red bg for removed lines", () => {
    expect(diffBg("-removed")).toBe("bg-red-400/8");
  });

  it("returns empty string for context lines", () => {
    expect(diffBg(" context")).toBe("");
  });
});
