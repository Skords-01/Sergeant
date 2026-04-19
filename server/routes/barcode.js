import { Router } from "express";
import { asyncHandler, rateLimitExpress, setModule } from "../http/index.js";
import barcodeHandler from "../modules/barcode.js";

export function createBarcodeRouter() {
  const r = Router();
  r.get(
    "/api/barcode",
    setModule("barcode"),
    rateLimitExpress({ key: "api:barcode", limit: 30, windowMs: 60_000 }),
    asyncHandler(barcodeHandler),
  );
  return r;
}
