// most stderr bytes one Git command may write before its result is refused as invalid output
export const MAX_GIT_DIAGNOSTIC_BYTES = 4096;

/*
 * Seconds one Git command may run. The CLI's read-only commands finish in seconds even for a
 * 100,000-entry repository, so the ceiling only stops a Git process that hangs, such as on a
 * stalled network file system.
 */
export const GIT_TIMEOUT_SECONDS = 300;
