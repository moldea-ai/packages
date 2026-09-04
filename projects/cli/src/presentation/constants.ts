import { MOLDEA_CLI_COMMANDS } from '../command-line/index.js';

// stable safe presentation contracts for errors implemented by the CLI
export const MOLDEA_CLI_ERROR_DEFINITIONS = Object.freeze({
  COMPOSITION_STATE_INVALID: Object.freeze({
    message: 'The installed composition state is invalid.',
    retryable: false,
    source: 'cli',
  }),
  CONTENT_INVALID: Object.freeze({
    message: 'The requested canonical asset is not valid moldea text.',
    retryable: false,
    source: 'cli',
  }),
  CONTENT_PATH_INVALID: Object.freeze({
    message: 'The content path must identify one canonical moldea text asset.',
    retryable: false,
    source: 'cli',
  }),
  CURSOR_INVALID: Object.freeze({
    message: 'The continuation cursor is invalid for this request.',
    retryable: false,
    source: 'cli',
  }),
  CURSOR_SNAPSHOT_CHANGED: Object.freeze({
    message: 'The continuation cursor belongs to a different repository snapshot.',
    retryable: true,
    source: 'cli',
  }),
  GIT_ACCESS_DENIED: Object.freeze({
    message: 'Git access was denied.',
    retryable: true,
    source: 'git',
  }),
  GIT_COMMAND_FAILED: Object.freeze({
    message: 'The Git command failed.',
    retryable: true,
    source: 'git',
  }),
  GIT_CONTENT_TRANSFORM_UNSUPPORTED: Object.freeze({
    message: 'The requested file uses an unsupported Git content transformation.',
    retryable: false,
    source: 'git',
  }),
  GIT_NOT_FOUND: Object.freeze({
    message: 'The Git executable is unavailable.',
    retryable: false,
    source: 'git',
  }),
  GIT_OPERATION_ABORTED: Object.freeze({
    message: 'The Git operation was aborted.',
    retryable: true,
    source: 'git',
  }),
  GIT_OUTPUT_INVALID: Object.freeze({
    message: 'Git returned invalid output.',
    retryable: false,
    source: 'git',
  }),
  GIT_REPOSITORY_NOT_FOUND: Object.freeze({
    message: 'The selected path is not inside a Git repository.',
    retryable: false,
    source: 'git',
  }),
  GIT_SPARSE_CHECKOUT_UNSUPPORTED: Object.freeze({
    message: 'Sparse Git checkouts are unsupported.',
    retryable: false,
    source: 'git',
  }),
  GIT_VERSION_INVALID: Object.freeze({
    message: 'The Git version output is invalid.',
    retryable: false,
    source: 'git',
  }),
  GIT_VERSION_UNSUPPORTED: Object.freeze({
    message: 'The installed Git version is unsupported.',
    retryable: false,
    source: 'git',
  }),
  GIT_WORK_TREE_REQUIRED: Object.freeze({
    message: 'A usable Git working tree is required.',
    retryable: false,
    source: 'git',
  }),
  INTERNAL_ERROR: Object.freeze({
    message: 'The command could not be completed.',
    retryable: false,
    source: 'cli',
  }),
  INVALID_ARGUMENT: Object.freeze({
    message: 'The command invocation is invalid.',
    retryable: false,
    source: 'cli',
  }),
  OUTPUT_BUDGET_TOO_SMALL: Object.freeze({
    message: 'The output byte budget cannot contain the next complete result.',
    retryable: false,
    source: 'cli',
  }),
  PATH_INPUT_INVALID: Object.freeze({
    message: 'The NUL-delimited changed-path input is invalid.',
    retryable: false,
    source: 'cli',
  }),
  RESOURCE_LIMIT_CONFIGURATION_INVALID: Object.freeze({
    message: 'The resource-limit configuration is invalid.',
    retryable: false,
    source: 'cli',
  }),
  RESOURCE_LIMIT_EXCEEDED: Object.freeze({
    message: 'A resource limit was exceeded.',
    retryable: false,
    source: 'cli',
  }),
  WORKING_TREE_UNSTABLE: Object.freeze({
    message: 'The working tree did not remain stable.',
    retryable: true,
    source: 'cli',
  }),
} as const);

// source descriptor for results derived from the selected Git working tree
export const MOLDEA_CLI_GIT_WORKING_TREE_SOURCE = Object.freeze({
  kind: 'git-working-tree' as const,
});

// top-level help presented without repository access
export const MOLDEA_CLI_TOP_LEVEL_HELP = `Usage: moldea <command> [options]

Commands:
  validate       Validate the current moldea project.
  inspect        Inspect content-free project metadata.
  scope          Match changed paths to declared moldea relationships.
  content        Read one canonical moldea asset explicitly.
  composition    Report the installed CLI composition state.

Global options:
  --help     Show top-level help.
  --version  Show the CLI version.

Run "moldea <command> --help" for command-specific options.
`;

const REPOSITORY_OPTIONS_HELP = `  --repository <path>                Select a Git working-tree directory.
  --json                             Emit one machine-readable JSON result.
  --no-color                         Disable ANSI styling in human output.
`;

const BASE_RESOURCE_OPTIONS_HELP = `  --max-entries <integer>            Override the repository entry limit.
  --max-file-bytes <integer>         Override the per-file byte limit.
  --max-total-bytes <integer>        Override the total cached-byte limit.
`;

const INSPECTION_RESOURCE_OPTIONS_HELP = `${BASE_RESOURCE_OPTIONS_HELP}  --max-manifest-bytes <integer>     Override the manifest byte limit.
  --max-diagnostics <integer>        Override the diagnostic count limit.
`;

const PAGINATION_OPTIONS_HELP = `  --max-output-bytes <integer>       Bound JSON output from 4096 to 1048576 bytes.
  --cursor <opaque-cursor>           Continue a prior JSON result page.
`;

const COMPLETE_INSPECTION_OPTIONS_HELP = `${REPOSITORY_OPTIONS_HELP}${INSPECTION_RESOURCE_OPTIONS_HELP}  --max-evidence <integer>           Override the adapter evidence count limit.
${PAGINATION_OPTIONS_HELP}`;

const SCOPE_OPTIONS_HELP = `${REPOSITORY_OPTIONS_HELP}${INSPECTION_RESOURCE_OPTIONS_HELP}${PAGINATION_OPTIONS_HELP}`;

const CONTENT_OPTIONS_HELP = `${REPOSITORY_OPTIONS_HELP}${BASE_RESOURCE_OPTIONS_HELP}${PAGINATION_OPTIONS_HELP}`;

// complete command-specific help keyed by the closed command set
export const MOLDEA_CLI_COMMAND_HELP = {
  [MOLDEA_CLI_COMMANDS.Composition]: `Usage: moldea composition [options]

Report the installed CLI composition state.

Options:
  --json      Emit one machine-readable JSON result.
  --no-color  Disable ANSI styling in human output.
  --help      Show this help.
`,
  [MOLDEA_CLI_COMMANDS.Inspect]: `Usage: moldea inspect [options]

Inspect content-free metadata for the current moldea project.

Options:
${COMPLETE_INSPECTION_OPTIONS_HELP}  --help                             Show this help.
`,
  [MOLDEA_CLI_COMMANDS.Scope]: `Usage: moldea scope (--path <logical-path> | --paths-stdin) [options]

Match changed repository paths to declared moldea relationships. The stdin form accepts NUL-delimited UTF-8 logical paths.

Options:
${SCOPE_OPTIONS_HELP}  --path <logical-path>               Match one repository-logical path.
  --paths-stdin                      Read NUL-delimited paths from stdin.
  --help                             Show this help.
`,
  [MOLDEA_CLI_COMMANDS.Content]: `Usage: moldea content --path <canonical-logical-path> [options]

Read one canonical moldea text asset in bounded Unicode-safe chunks.

Options:
${CONTENT_OPTIONS_HELP}  --path <canonical-logical-path>     Select exactly one canonical moldea file.
  --help                             Show this help.
`,
  [MOLDEA_CLI_COMMANDS.Validate]: `Usage: moldea validate [options]

Validate the current moldea project.

Options:
${COMPLETE_INSPECTION_OPTIONS_HELP}  --help                             Show this help.
`,
} as const;
