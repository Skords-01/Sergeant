/**
 * Централізовані query-keys для React Query хуків `@sergeant/api-client/react`.
 *
 * Правило: ключі групуються по модулю (perfy.all, coach.all, …). Кожен
 * «list-подібний» ключ повертає масив `readonly [namespace, subResource, ...args]`,
 * щоб можна було робити `queryClient.invalidateQueries({ queryKey: ['coach'] })`
 * для інвалідації цілого підпростору.
 */
export const apiQueryKeys = {
  coach: {
    all: ["coach"] as const,
    memory: () => ["coach", "memory"] as const,
  },
  push: {
    all: ["push"] as const,
    vapidPublic: () => ["push", "vapid-public"] as const,
  },
  foodSearch: {
    all: ["food-search"] as const,
    query: (q: string) => ["food-search", q] as const,
  },
  barcode: {
    all: ["barcode"] as const,
    lookup: (barcode: string) => ["barcode", barcode] as const,
  },
  mono: {
    all: ["mono"] as const,
    clientInfo: (token: string) => ["mono", "client-info", token] as const,
    statement: (token: string, accId: string, from: number, to: number) =>
      ["mono", "statement", token, accId, from, to] as const,
  },
  privat: {
    all: ["privat"] as const,
    balanceFinal: (merchantId: string) =>
      ["privat", "balance-final", merchantId] as const,
  },
} as const;
