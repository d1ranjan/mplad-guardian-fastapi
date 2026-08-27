import { describe, expect, it } from "vitest";
import { apiUrl, normaliseApiBaseUrl } from "./api";

describe("normaliseApiBaseUrl", () => {
  it("uses the same-origin FastAPI prefix when no external API is configured", () => {
    expect(normaliseApiBaseUrl()).toBe("/api/v1");
  });

  it("removes a trailing slash from a public Render API base URL", () => {
    expect(normaliseApiBaseUrl("https://mplad-guardian-fastapi.onrender.com/api/v1/")).toBe("https://mplad-guardian-fastapi.onrender.com/api/v1");
  });

  it("reaches the configured public API health probe", async () => {
    const response = await fetch(apiUrl("/health"));
    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({ status: "ok", service: "mplad-guardian-fastapi" });
  }, 90_000);
});
