import { describe, it, expect } from "vitest";
import {
  HUB_BACKUP_KIND,
  HUB_BACKUP_SCHEMA_VERSION,
  isHubBackupPayload,
} from "./hubBackup";

describe("hubBackup", () => {
  it("isHubBackupPayload приймає валідний корінь", () => {
    expect(
      isHubBackupPayload({
        kind: HUB_BACKUP_KIND,
        schemaVersion: HUB_BACKUP_SCHEMA_VERSION,
      }),
    ).toBe(true);
  });

  it("відхиляє сторонні об'єкти", () => {
    expect(isHubBackupPayload(null)).toBe(false);
    expect(isHubBackupPayload({ kind: "other" })).toBe(false);
    expect(isHubBackupPayload({ kind: HUB_BACKUP_KIND })).toBe(false);
  });
});
