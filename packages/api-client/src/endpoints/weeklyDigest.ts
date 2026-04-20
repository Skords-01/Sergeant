import type { HttpClient } from "../httpClient";

export interface WeeklyDigestPayload {
  weekRange: unknown;
  finyk: unknown;
  fizruk: unknown;
  nutrition: unknown;
  routine: unknown;
}

export interface WeeklyDigestResponse {
  report?: unknown;
  generatedAt?: string;
  error?: string;
}

export interface WeeklyDigestEndpoints {
  generate: (payload: WeeklyDigestPayload) => Promise<WeeklyDigestResponse>;
}

export function createWeeklyDigestEndpoints(
  http: HttpClient,
): WeeklyDigestEndpoints {
  return {
    generate: (payload) =>
      http.post<WeeklyDigestResponse>("/api/weekly-digest", payload),
  };
}
