import "@testing-library/jest-dom/vitest";
import { server } from "./msw/server";
import { afterAll, afterEach, beforeAll } from "vitest";

// Wire MSW lifecycle: intercept outgoing requests in all test suites.
// Per-test overrides via `server.use(...)` are reset after each test.
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
