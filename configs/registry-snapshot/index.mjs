/*
 * Packed-consumer checks resolve third-party dependencies only from versions published before
 * this reviewed instant, so a new upstream release cannot change a pull-request or release
 * verdict. Advance it deliberately after the scheduled Registry Canary passes on the live
 * registry, and keep it at least one minute after the publish time of every @moldea.ai release
 * that downstream candidate workflows install from the registry: npm's --before has no scope
 * exemption, and pnpm rounds the release age up to whole minutes.
 */
export const REGISTRY_SNAPSHOT = '2026-10-24T18:37:00.000Z';

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
