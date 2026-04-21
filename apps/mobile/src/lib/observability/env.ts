/**
 * DSN accessor split into its own module so Jest can `jest.mock` the
 * read and drive `initObservability` through both the DSN-set and
 * DSN-absent branches in a single test file. At production build time
 * Expo's babel preset inlines the `process.env.EXPO_PUBLIC_SENTRY_DSN`
 * literal here — the inlined value is the only thing that ships.
 */

export function getSentryDsn(): string | undefined {
  return process.env.EXPO_PUBLIC_SENTRY_DSN;
}
