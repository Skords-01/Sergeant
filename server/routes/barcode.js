import { Router } from "express";
import { asyncHandler } from "../http/index.js";
import barcodeHandler from "../modules/barcode.js";

export function createBarcodeRouter() {
  const r = Router();
  r.get("/api/barcode", asyncHandler(barcodeHandler));
  return r;
}
