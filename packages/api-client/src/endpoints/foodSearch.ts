import type { HttpClient } from "../httpClient";

export interface FoodSearchProduct {
  id?: string | number;
  name?: string;
  brand?: string;
  [key: string]: unknown;
}

export interface FoodSearchResponse {
  products?: FoodSearchProduct[];
  error?: string;
}

export interface FoodSearchEndpoints {
  search: (
    query: string,
    opts?: { signal?: AbortSignal },
  ) => Promise<FoodSearchResponse>;
}

export function createFoodSearchEndpoints(
  http: HttpClient,
): FoodSearchEndpoints {
  return {
    search: (query, opts) =>
      http.get<FoodSearchResponse>("/api/food-search", {
        query: { q: query },
        signal: opts?.signal,
      }),
  };
}
