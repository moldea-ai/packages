import path from 'node:path';
import process from 'node:process';

import { MAX_GIT_DISCOVERY_OUTPUT_BYTES } from './constants.js';

const UTF8_BYTE_ORDER_MARK = [0xef, 0xbb, 0xbf] as const;

/**
 * Decodes one bounded Git output value as strict UTF-8.
 * @param output The raw Git output bytes.
 * @returns The exact decoded value, or null when invalid.
 */
const decodeGitOutput = (output: Uint8Array): string | null => {
  if (
    output.byteLength === 0 ||
    output.byteLength > MAX_GIT_DISCOVERY_OUTPUT_BYTES ||
    UTF8_BYTE_ORDER_MARK.every((byte, index) => output[index] === byte)
  ) {
    return null;
  }

  let decodedOutput: string;

  try {
    decodedOutput = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(output);
  } catch {
    return null;
  }

  if (decodedOutput.includes('\0') || !decodedOutput.isWellFormed()) {
    return null;
  }

  return decodedOutput;
};

/**
 * Parses one nonempty path returned by Git.
 * @param output The raw bounded Git stdout bytes.
 * @returns The exact relative or absolute path, or null when the output is invalid.
 */
export const parseGitPathOutput = (output: Uint8Array): string | null => {
  const decodedOutput = decodeGitOutput(output);

  if (decodedOutput === null || !decodedOutput.endsWith('\n')) {
    return null;
  }

  const gitPath =
    process.platform === 'win32' && decodedOutput.endsWith('\r\n')
      ? decodedOutput.slice(0, -2)
      : decodedOutput.slice(0, -1);

  return gitPath.length === 0 ? null : gitPath;
};

/**
 * Parses one absolute path returned by Git.
 * @param output The raw bounded Git stdout bytes.
 * @returns The exact absolute path, or null when the output is invalid.
 */
export const parseGitAbsolutePathOutput = (output: Uint8Array): string | null => {
  const gitPath = parseGitPathOutput(output);

  if (gitPath === null || !path.isAbsolute(gitPath)) {
    return null;
  }

  return gitPath;
};
