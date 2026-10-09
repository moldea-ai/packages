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

// provisional candidate; final profile selection requires both consumer qualification lanes
export const NODE_INSPECTION_OLD_GENERATION_MIB = 512;
export const NODE_INSPECTION_YOUNG_GENERATION_MIB = 24;
