// whole-attempt lifetime and bounded bridge ownership, independent of source file size
export const NODE_INSPECTION_LIFETIME_MS = 120_000;
export const NODE_INSPECTION_TERMINATION_GRACE_MS = 1_000;
export const NODE_INSPECTION_MAX_REQUESTS = 4;
export const NODE_INSPECTION_FILE_PAGE_BYTES = 65_536;
export const NODE_INSPECTION_MESSAGE_BYTES = 1_048_576;
export const NODE_INSPECTION_STDIO_BYTES = 32_768;

// two UTF-16 bytes per serialized byte, two copies at each owner, for every RPC credit
export const NODE_INSPECTION_TRANSPORT_BYTES =
  NODE_INSPECTION_MAX_REQUESTS * NODE_INSPECTION_MESSAGE_BYTES * 2 * 2 * 3;

// fixed profile qualified in the constrained CLI and actual-worker lanes
export const NODE_INSPECTION_OLD_GENERATION_MIB = 512;
export const NODE_INSPECTION_YOUNG_GENERATION_MIB = 24;

// immutable execution identity for consumers that authenticate prepared inspection state
export const NODE_INSPECTION_PROFILE = Object.freeze({
  lifetimeMs: NODE_INSPECTION_LIFETIME_MS,
  terminationGraceMs: NODE_INSPECTION_TERMINATION_GRACE_MS,
  maxReaderRequests: NODE_INSPECTION_MAX_REQUESTS,
  maxFilePageBytes: NODE_INSPECTION_FILE_PAGE_BYTES,
  maxMessageBytes: NODE_INSPECTION_MESSAGE_BYTES,
  maxStdioBytes: NODE_INSPECTION_STDIO_BYTES,
  transportBytes: NODE_INSPECTION_TRANSPORT_BYTES,
  oldGenerationMiB: NODE_INSPECTION_OLD_GENERATION_MIB,
  youngGenerationMiB: NODE_INSPECTION_YOUNG_GENERATION_MIB,
});
