// immutable adapter and verified target identities
export const EVE_ADAPTER_ID = 'eve';
export const EVE_PACKAGE_NAME = 'eve';
export const EVE_SUPPORTED_PACKAGE_RANGE = '>=0.39.1';
export const EVE_TARGET_ID = 'typescript-filesystem-agent-0-39';
export const EVE_SUPPORTED_REPOSITORY_FORMAT_VERSIONS = Object.freeze([1] as const);
export const EVE_DEFAULT_TOOLS_BOUNDARY_VERSION = '0.65.0';
export const EVE_DEFAULT_TOOLS_OPTION_BOUNDARY_VERSION = '0.52.2';
export const EVE_TEST_EXCLUSION_BOUNDARY_VERSION = '0.66.2';
export const EVE_AGENT_OUTPUT_SCHEMA_REMOVAL_VERSION = '0.67.0';
export const EVE_WORKFLOW_TOOL_BOUNDARY_VERSION = '0.52.0';
export const EVE_TASK_CANCEL_BOUNDARY_VERSION = '0.52.2';
export const EVE_WORKSPACE_AGENT_BOUNDARY_VERSION = '0.54.3';
export const EVE_SUBAGENT_TOOL_EXPOSURE_BOUNDARY_VERSION = '0.61.0';
export const EVE_SUBAGENT_MODEL_VISIBILITY_BOUNDARY_VERSION = '0.59.1';

// Eve-authored module extensions used only for filesystem-slot preflight
export const EVE_AUTHORED_MODULE_EXTENSIONS = Object.freeze([
  '.cts',
  '.mts',
  '.cjs',
  '.mjs',
  '.ts',
  '.js',
] as const);

// runtime-visible names and grammars established by Eve 0.39.1
export const EVE_TOOL_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;
export const EVE_RESERVED_TOOL_NAME = 'Workflow';
export const EVE_STABLE_DEFAULT_TOOL_NAMES = Object.freeze([
  'bash',
  'read_file',
  'write_file',
  'web_fetch',
  'web_search',
  'load_skill',
] as const);
export const EVE_REMOVED_DEFAULT_TOOL_NAMES = Object.freeze(['ask_question', 'todo'] as const);
export const EVE_ROOT_COPY_TOOL_NAME = 'agent';
export const EVE_TASK_CANCEL_TOOL_NAME = 'task_cancel';
