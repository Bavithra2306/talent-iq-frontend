
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env } from "../config/env";

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// The access cookie lives 15 minutes. On a 401, refresh it once (shared by all
// requests that fail at the same moment) and retry the original request.
let refreshing: Promise<void> | null = null;

const NO_RETRY = ["/api/v1/auth/login", "/api/v1/internal/login", "/api/v1/auth/refresh", "/api/v1/auth/logout"];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const url = original?.url ?? "";
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retried ||
      NO_RETRY.some((path) => url.includes(path))
    ) {
      throw error;
    }
    original._retried = true;
    refreshing ??= apiClient
      .post("/api/v1/auth/refresh", null)
      .then(() => undefined)
      .finally(() => {
        refreshing = null;
      });
    await refreshing;
    return apiClient(original);
  },
);

/** A readable message from an API error (FastAPI puts it in `detail`). */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, "");
    if (!error.response) return "Cannot reach the server. Check that the services are running.";
  }
  return fallback;
}
