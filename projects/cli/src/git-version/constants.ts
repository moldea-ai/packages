// numeric components of the oldest Git version supported by the CLI
export const MINIMUM_GIT_VERSION_COMPONENTS = Object.freeze({
  major: 2,
  minor: 32,
  patch: 0,
});

// oldest Git version supported by the CLI
export const MINIMUM_GIT_VERSION = `${MINIMUM_GIT_VERSION_COMPONENTS.major}.${MINIMUM_GIT_VERSION_COMPONENTS.minor}.${MINIMUM_GIT_VERSION_COMPONENTS.patch}`;

// most bytes the Git version command's stdout and stderr may take together
export const MAX_GIT_VERSION_OUTPUT_BYTES = 4096;
