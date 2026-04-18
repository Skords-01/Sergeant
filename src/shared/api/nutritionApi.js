import { httpRequest } from "./client.js";

export function foodSearch(query) {
  return httpRequest(`/api/food-search?q=${encodeURIComponent(query)}`);
}

export function barcodeLookup(barcode) {
  return httpRequest(`/api/barcode?barcode=${encodeURIComponent(barcode)}`);
}
