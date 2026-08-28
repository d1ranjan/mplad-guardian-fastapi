import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorDetail, fieldErrorsFromError, formatSemanticSimilarity, guardianRequest, validationIssuesFromError } from "./guardianApi";

describe("formatSemanticSimilarity", () => {
  it("formats the semantic_similarity response field as a percentage", () => {
    expect(formatSemanticSimilarity(0.8749)).toBe("87.5%");
  });

  it("turns a non-JSON backend failure into a visible request error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Gateway unavailable", { status: 502 })));
    await expect(guardianRequest("/projects", "token")).rejects.toThrow("Gateway unavailable");
  });

  it("preserves missing-header diagnostics for the CSV validation report", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: { message: "Required columns are missing after header normalization.", missing_headers: ["project_code"], received_headers: ["Project ID"] } }), { status: 422, headers: { "Content-Type": "application/json" } })));
    const error = await guardianRequest("/imports/validate", "token").catch(reason => reason);
    expect(validationIssuesFromError(error)[0].message).toContain("project_code");
    expect(apiErrorDetail(error)?.received_headers).toEqual(["Project ID"]);
  });

  it("preserves inline login field errors from the API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: { message: "Invalid email or password.", field_errors: { email: "Check the analyst ID or email address.", password: "Check the password and try again." } } }), { status: 401, headers: { "Content-Type": "application/json" } })));
    const error = await guardianRequest("/auth/login").catch(reason => reason);
    expect(fieldErrorsFromError(error)).toEqual({ email: "Check the analyst ID or email address.", password: "Check the password and try again." });
  });
});

afterEach(() => vi.unstubAllGlobals());
