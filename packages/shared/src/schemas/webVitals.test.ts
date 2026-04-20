import { describe, it, expect } from "vitest";
import {
  WEB_VITALS_MAX_BATCH,
  WEB_VITALS_METRIC_NAMES,
  WEB_VITALS_TIMING_METRIC_NAMES,
  WebVitalsMetricSchema,
  WebVitalsPayloadSchema,
} from "./api";

describe("WebVitalsMetricSchema", () => {
  it.each(["LCP", "INP", "FCP", "TTFB"] as const)(
    "приймає таймінг %s у межах 0..120000 мс",
    (name) => {
      expect(
        WebVitalsMetricSchema.parse({ name, value: 1234, rating: "good" }),
      ).toEqual({ name, value: 1234, rating: "good" });
    },
  );

  it("приймає CLS у 0..10 як float", () => {
    expect(
      WebVitalsMetricSchema.parse({ name: "CLS", value: 0.25, rating: "poor" }),
    ).toEqual({ name: "CLS", value: 0.25, rating: "poor" });
  });

  it.each(["LCP", "INP", "FCP", "TTFB"] as const)(
    "відкидає таймінг %s > 120000",
    (name) => {
      expect(
        WebVitalsMetricSchema.safeParse({
          name,
          value: 120_001,
          rating: "poor",
        }).success,
      ).toBe(false);
    },
  );

  it("відкидає CLS > 10", () => {
    expect(
      WebVitalsMetricSchema.safeParse({
        name: "CLS",
        value: 10.1,
        rating: "poor",
      }).success,
    ).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.001])(
    "відкидає value %p",
    (value) => {
      expect(
        WebVitalsMetricSchema.safeParse({
          name: "LCP",
          value,
          rating: "good",
        }).success,
      ).toBe(false);
    },
  );

  it("відкидає невідому метрику", () => {
    expect(
      WebVitalsMetricSchema.safeParse({
        name: "TBT",
        value: 10,
        rating: "good",
      }).success,
    ).toBe(false);
  });

  it("відкидає невідомий rating", () => {
    expect(
      WebVitalsMetricSchema.safeParse({
        name: "LCP",
        value: 10,
        rating: "meh",
      }).success,
    ).toBe(false);
  });
});

describe("WebVitalsPayloadSchema", () => {
  it("потребує min 1 метрику", () => {
    expect(WebVitalsPayloadSchema.safeParse({ metrics: [] }).success).toBe(
      false,
    );
  });

  it(`приймає до ${WEB_VITALS_MAX_BATCH} метрик`, () => {
    const metrics = Array.from({ length: WEB_VITALS_MAX_BATCH }, () => ({
      name: "LCP" as const,
      value: 100,
      rating: "good" as const,
    }));
    expect(WebVitalsPayloadSchema.parse({ metrics }).metrics).toHaveLength(
      WEB_VITALS_MAX_BATCH,
    );
  });

  it(`відкидає > ${WEB_VITALS_MAX_BATCH} метрик`, () => {
    const metrics = Array.from({ length: WEB_VITALS_MAX_BATCH + 1 }, () => ({
      name: "LCP" as const,
      value: 100,
      rating: "good" as const,
    }));
    expect(WebVitalsPayloadSchema.safeParse({ metrics }).success).toBe(false);
  });
});

describe("WEB_VITALS_METRIC_NAMES / WEB_VITALS_TIMING_METRIC_NAMES", () => {
  it("таймінги — підмножина всіх метрик", () => {
    for (const name of WEB_VITALS_TIMING_METRIC_NAMES) {
      expect(WEB_VITALS_METRIC_NAMES).toContain(name);
    }
  });

  it("CLS — поза таймінгами", () => {
    expect(WEB_VITALS_TIMING_METRIC_NAMES).not.toContain(
      "CLS" as unknown as (typeof WEB_VITALS_TIMING_METRIC_NAMES)[number],
    );
  });
});
