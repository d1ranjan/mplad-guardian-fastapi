export function normaliseApiBaseUrl(value?: string): string {
  const candidate = value?.trim().replace(/\/+$/, "");
  return candidate || "/api/v1";
}

export const API_BASE_URL = normaliseApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function apiDocsUrl(): string {
  return API_BASE_URL.endsWith("/api/v1") ? `${API_BASE_URL.slice(0, -"/api/v1".length)}/docs` : "/docs";
}
