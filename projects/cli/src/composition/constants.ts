// exact first-class package identities required by every CLI release
export const MOLDEA_CLI_FOUNDATIONAL_PACKAGE_NAMES = Object.freeze([
  '@moldea.ai/core',
  '@moldea.ai/repository',
  '@moldea.ai/repository-fs',
] as const);

// compatible first-class package lines this CLI release accepts
export const MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES = Object.freeze({
  '@moldea.ai/core': '^9.0.0',
  '@moldea.ai/repository': '^4.0.0',
  '@moldea.ai/repository-fs': '^4.0.0',
} as const);
