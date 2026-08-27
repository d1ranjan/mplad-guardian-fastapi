import { describe, expect, it } from "vitest";
import { apiUrl, normaliseApiBaseUrl } from "./api";

describe("normaliseApiBaseUrl", () => {
  it("uses the same-origin FastAPI prefix when no external API is configured", () => {
    expect(normaliseApiBaseUrl()).toBe("/api/v1");
  });

  it("removes a trailing slash from a public Render API base URL", () => {
    expect(normaliseApiBaseUrl("https://mplad-guardian-fastapi.onrender.com/api/v1/")).toBe("https://mplad-guardian-fastapi.onrender.com/api/v1");
  });

  it("constructs the configured public API health endpoint", () => {
    expect(apiUrl("/health")).toBe("https://mplad-guardian-fastapi.onrender.com/api/v1/health");
  });

  it("keeps a public API path stable for retryable health requests", () => {
    expect(apiUrl("health")).toBe("https://mplad-guardian-fastapi.onrender.com/api/v1/health");
  });
});
