import { afterEach, describe, expect, it, vi } from "vitest";
import { formatSemanticSimilarity, guardianRequest } from "./guardianApi";

describe("formatSemanticSimilarity", () => {
  it("formats the semantic_similarity response field as a percentage", () => {
    expect(formatSemanticSimilarity(0.8749)).toBe("87.5%");
  });

  it("turns a non-JSON backend failure into a visible request error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Gateway unavailable", { status: 502 })));
    await expect(guardianRequest("/projects", "token")).rejects.toThrow("Gateway unavailable");
  });
});

afterEach(() => vi.unstubAllGlobals());
