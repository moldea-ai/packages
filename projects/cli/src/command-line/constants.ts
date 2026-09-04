// schema 3 command names accepted by the executable
export const MOLDEA_CLI_COMMANDS = {
  Composition: 'composition',
  Content: 'content',
  Inspect: 'inspect',
  Scope: 'scope',
  Validate: 'validate',
} as const;

// option names supported by the schema 3 command grammar
export const MOLDEA_CLI_OPTIONS = {
  Help: '--help',
  Json: '--json',
  Cursor: '--cursor',
  MaxDiagnostics: '--max-diagnostics',
  MaxEntries: '--max-entries',
  MaxEvidence: '--max-evidence',
  MaxFileBytes: '--max-file-bytes',
  MaxManifestBytes: '--max-manifest-bytes',
  MaxOutputBytes: '--max-output-bytes',
  MaxTotalBytes: '--max-total-bytes',
  NoColor: '--no-color',
  Path: '--path',
  PathsStdin: '--paths-stdin',
  Repository: '--repository',
  Version: '--version',
} as const;

// default resource bounds forwarded by later command-composition slices
export const DEFAULT_MOLDEA_CLI_RESOURCE_LIMITS = Object.freeze({
  maxDiagnostics: 10_000,
  maxEntries: 100_000,
  maxEvidence: 10_000,
  maxFileBytes: 8_388_608,
  maxManifestBytes: 2_097_152,
  maxTotalBytes: 134_217_728,
});
