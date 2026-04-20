import {
  useHashRoute,
  type UseHashRouteResult,
} from "@shared/hooks/useHashRoute";

export const FIZRUK_PAGES = [
  "dashboard",
  "plan",
  "atlas",
  "workouts",
  "progress",
  "measurements",
  "programs",
  "body",
  "exercise",
] as const;

export type FizrukPage = (typeof FIZRUK_PAGES)[number];

export interface FizrukRoute extends UseHashRouteResult<FizrukPage> {
  exerciseId?: string;
}

/**
 * Typed wrapper over `useHashRoute` for Fizruk. Exposes the usual
 * `{ page, navigate }` shape plus the optional `exerciseId` segment
 * used by deep links like `#exercise/<id>`.
 */
export function useFizrukRoute(): FizrukRoute {
  const route = useHashRoute<FizrukPage>({
    defaultPage: "dashboard",
    validPages: FIZRUK_PAGES,
  });
  return {
    ...route,
    exerciseId:
      route.page === "exercise" && route.segments[0]
        ? route.segments[0]
        : undefined,
  };
}
