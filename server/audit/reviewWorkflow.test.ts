import { describe, expect, it } from "vitest";
import { normaliseReviewNote, statusForReviewAction } from "./reviewWorkflow";

describe("reviewer workflow", () => {
  it("maps every reviewer disposition to the persisted alert status", () => {
    expect(statusForReviewAction("field_verification")).toBe("field_verification");
    expect(statusForReviewAction("dismissed")).toBe("dismissed");
    expect(statusForReviewAction("resolved")).toBe("resolved");
  });

  it("normalises reviewer notes before they are stored in case history", () => {
    expect(normaliseReviewNote("  Verify   ward-level completion record. \n")).toBe("Verify ward-level completion record.");
  });
});
