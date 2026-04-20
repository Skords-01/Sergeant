import type { HttpClient } from "../httpClient";

export interface BarcodeProduct {
  name?: string;
  brand?: string;
  servingGrams?: number;
  kcal_100g?: number;
  protein_100g?: number;
  fat_100g?: number;
  carbs_100g?: number;
  partial?: boolean;
}

export interface BarcodeLookupResponse {
  product?: BarcodeProduct | null;
  error?: string;
}

export interface BarcodeEndpoints {
  lookup: (barcode: string) => Promise<BarcodeLookupResponse>;
}

export function createBarcodeEndpoints(http: HttpClient): BarcodeEndpoints {
  return {
    lookup: (barcode) =>
      http.get<BarcodeLookupResponse>("/api/barcode", { query: { barcode } }),
  };
}
