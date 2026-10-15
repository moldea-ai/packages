/*
 * Packed-consumer checks resolve third-party dependencies only from versions published before
 * this reviewed instant, so a new upstream release cannot change a pull-request or release
 * verdict. Advance it deliberately after the scheduled Registry Canary passes on the live
 * registry.
 */
export const REGISTRY_SNAPSHOT = '2026-10-15T14:00:00.000Z';

/**
 * Returns the package-manager environment that pins resolution to the registry snapshot. npm
 * accepts the instant directly; pnpm expresses it as a minimum release age measured from now.
 * @param now The current time in milliseconds.
 * @returns Environment variables for npm and pnpm consumer installs.
 */
export const getRegistrySnapshotEnvironment = (now = Date.now()) => ({
  npm_config_before: REGISTRY_SNAPSHOT,
  pnpm_config_minimum_release_age: String(
    Math.ceil((now - Date.parse(REGISTRY_SNAPSHOT)) / 60_000),
  ),
});
