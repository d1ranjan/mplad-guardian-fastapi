import { describe, expect, it } from "vitest";
import { formatSemanticSimilarity } from "./guardianApi";

describe("formatSemanticSimilarity", () => {
  it("formats the semantic_similarity response field as a percentage", () => {
    expect(formatSemanticSimilarity(0.8749)).toBe("87.5%");
  });
});
