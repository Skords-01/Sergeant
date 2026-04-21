/**
 * Pure `sergeant://` deep-link parser + builder.
 *
 * Source of truth for the URL schemes this module supports is
 * `docs/mobile.md` (section "Deep links"). Keep that table and the
 * `SergeantDeepLink` discriminated union below in lock-step.
 *
 * Intentionally dep-free — runs in any JS environment (node tests,
 * Hermes, web). Runtime wiring into `expo-router` lives in
 * `useDeepLinks.ts`; this file exports only pure helpers so the
 * scheme-matching rules are unit-testable without mocking
 * `expo-linking` / `expo-router`.
 */
import type { Href } from "expo-router";

export const SERGEANT_SCHEME = "sergeant://";

/**
 * Structured representation of every deep link the mobile client
 * currently accepts. Adding a new scheme = extending this union +
 * adding a case in `parseSergeantUrl` / `buildSergeantUrl` /
 * `hrefForDeepLink`.
 */
export type SergeantDeepLink =
  | { type: "hub" }
  | { type: "workout-new" }
  | { type: "workout"; id: string }
  | { type: "food-log" }
  | { type: "food-scan" }
  | { type: "food-recipe"; id: string }
  | { type: "finance" }
  | { type: "finance-tx"; id: string }
  | { type: "routine" }
  | { type: "routine-habit"; id: string }
  | { type: "settings" }
  | { type: "auth-callback"; token: string; params?: Record<string, string> };

/**
 * Parse a raw URL string into a `SergeantDeepLink`. Returns `null`
 * for anything that is not a well-formed `sergeant://…` URL the
 * client knows how to route.
 *
 * Contract:
 *   - Scheme must be exactly `sergeant://`. `http(s)://`, `exp://`,
 *     and bare strings all return `null`.
 *   - Leading / trailing slashes on the path are ignored, so
 *     `sergeant://routine`, `sergeant://routine/`, and
 *     `sergeant:///routine/` all parse identically.
 *   - Dynamic segments (`{id}`) preserve whatever string the caller
 *     passed, including zero-padded IDs (`workout/007`) and
 *     percent-encoded UUIDs — callers are responsible for decoding
 *     / validating before using it in native query params.
 *   - `auth/callback` additionally requires a non-empty `token`
 *     query param; missing / empty token → `null`.
 *   - Unknown segment combinations (`sergeant://foo`, extra segments
 *     after a terminal route like `workout/123/extra`) → `null`,
 *     so the caller can fall back to the hub.
 */
export function parseSergeantUrl(
  raw: string | null | undefined,
): SergeantDeepLink | null {
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith(SERGEANT_SCHEME)) return null;

  const rest = raw.slice(SERGEANT_SCHEME.length);
  const hashIdx = rest.indexOf("#");
  const withoutHash = hashIdx >= 0 ? rest.slice(0, hashIdx) : rest;
  const queryIdx = withoutHash.indexOf("?");
  const pathPart = queryIdx >= 0 ? withoutHash.slice(0, queryIdx) : withoutHash;
  const queryPart = queryIdx >= 0 ? withoutHash.slice(queryIdx + 1) : "";

  const tokens = pathPart
    .split("/")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return { type: "hub" };
  }

  const [a, b, c, ...rest4] = tokens;

  switch (a) {
    case "workout": {
      if (rest4.length > 0) return null;
      if (b === "new" && c === undefined) return { type: "workout-new" };
      if (b && c === undefined && b !== "new")
        return { type: "workout", id: b };
      return null;
    }
    case "food": {
      if (b === "log" && c === undefined && rest4.length === 0)
        return { type: "food-log" };
      if (b === "scan" && c === undefined && rest4.length === 0)
        return { type: "food-scan" };
      if (b === "recipe" && c && rest4.length === 0)
        return { type: "food-recipe", id: c };
      return null;
    }
    case "finance": {
      if (b === undefined) return { type: "finance" };
      if (b === "tx" && c && rest4.length === 0)
        return { type: "finance-tx", id: c };
      return null;
    }
    case "routine": {
      if (b === undefined) return { type: "routine" };
      if (b === "habit" && c && rest4.length === 0)
        return { type: "routine-habit", id: c };
      return null;
    }
    case "settings": {
      if (b === undefined && c === undefined) return { type: "settings" };
      return null;
    }
    case "auth": {
      if (b === "callback" && c === undefined && rest4.length === 0) {
        const params = parseQuery(queryPart);
        const token = params.token;
        if (!token) return null;
        return { type: "auth-callback", token, params };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Inverse of `parseSergeantUrl`. Always returns a canonical URL
 * (lower-case scheme, no duplicate slashes) so round-tripping
 * `buildSergeantUrl(parseSergeantUrl(u))` yields a normalised form.
 */
export function buildSergeantUrl(link: SergeantDeepLink): string {
  switch (link.type) {
    case "hub":
      return "sergeant://";
    case "workout-new":
      return "sergeant://workout/new";
    case "workout":
      return `sergeant://workout/${encodeURIComponent(link.id)}`;
    case "food-log":
      return "sergeant://food/log";
    case "food-scan":
      return "sergeant://food/scan";
    case "food-recipe":
      return `sergeant://food/recipe/${encodeURIComponent(link.id)}`;
    case "finance":
      return "sergeant://finance";
    case "finance-tx":
      return `sergeant://finance/tx/${encodeURIComponent(link.id)}`;
    case "routine":
      return "sergeant://routine";
    case "routine-habit":
      return `sergeant://routine/habit/${encodeURIComponent(link.id)}`;
    case "settings":
      return "sergeant://settings";
    case "auth-callback": {
      const params = { ...(link.params ?? {}), token: link.token };
      const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
      return `sergeant://auth/callback?${qs}`;
    }
  }
}

/**
 * Map a parsed deep link onto the Expo Router `Href` it resolves to.
 *
 * Kept separate from `parseSergeantUrl` so unit tests do not need
 * to know the file-based route tree (which may evolve as modules
 * are fleshed out). When a target route has not landed yet we
 * still return a typed `Href` to a stub screen — see
 * `app/(tabs)/fizruk/workout/[id].tsx` etc.
 *
 * Non-routable entries (currently only `auth-callback`, which the
 * caller consumes imperatively via `@better-auth/expo/client`)
 * return `null` so the hook does not push a spurious screen.
 */
export function hrefForDeepLink(link: SergeantDeepLink): Href | null {
  switch (link.type) {
    case "hub":
      return "/(tabs)";
    case "workout-new":
      return "/(tabs)/fizruk/workout/new";
    case "workout":
      return {
        pathname: "/(tabs)/fizruk/workout/[id]",
        params: { id: link.id },
      };
    case "food-log":
      return "/(tabs)/nutrition";
    case "food-scan":
      return "/(tabs)/nutrition/scan";
    case "food-recipe":
      return {
        pathname: "/(tabs)/nutrition/recipe/[id]",
        params: { id: link.id },
      };
    case "finance":
      return "/(tabs)/finyk";
    case "finance-tx":
      return {
        pathname: "/(tabs)/finyk/tx/[id]",
        params: { id: link.id },
      };
    case "routine":
      return "/(tabs)/routine";
    case "routine-habit":
      return {
        pathname: "/(tabs)/routine/habit/[id]",
        params: { id: link.id },
      };
    case "settings":
      return "/settings";
    case "auth-callback":
      // Consumed imperatively by the Better Auth Expo client; no
      // visible route push is required.
      return null;
  }
}

function parseQuery(q: string): Record<string, string> {
  if (!q) return {};
  const out: Record<string, string> = {};
  for (const pair of q.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const k = eq >= 0 ? pair.slice(0, eq) : pair;
    const v = eq >= 0 ? pair.slice(eq + 1) : "";
    if (!k) continue;
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}
