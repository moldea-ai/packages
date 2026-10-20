import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { hasErrorCode } from 'jg-exception';
import { ERRORS as PROCESS_ERRORS, createShutdownSignal, readStdin } from 'jg-process';

import { runMoldeaCli } from '../cli-execution/index.js';
import type { IMoldeaCliStdinReader } from '../cli-execution/index.js';
import { loadMoldeaCliPackageMetadata } from '../package-metadata/index.js';
import { createMoldeaCliOwnedError, formatMoldeaCliHumanError } from '../presentation/index.js';

const executableDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageManifestPath = path.resolve(executableDirectory, '..', 'package.json');

// SIGINT, SIGTERM, or the launcher closing the IPC channel stops the run; the exit code is set here
const shutdown = createShutdownSignal({ disconnect: true, setExitCode: false });

/** Reads process stdin without retaining bytes above the requested limit. */
const readProcessStdin: IMoldeaCliStdinReader = async (maxBytes, signal) => {
  try {
    return { bytes: await readStdin({ maxBytes, signal }), kind: 'completed' };
  } catch (error) {
    if (hasErrorCode(error, PROCESS_ERRORS.STDIN_TOO_LARGE)) {
      return { kind: 'limit-exceeded' };
    }

    // a stopped run ends the read early and never uses its bytes
    if (signal?.aborted === true) {
      return { bytes: new Uint8Array(), kind: 'completed' };
    }

    throw error;
  }
};

/**
 * Writes one complete process output string.
 * @param outputStream The destination process stream.
 * @param output The complete output to write.
 * @returns A promise resolving after the stream accepts the output.
 */
const writeProcessOutput = async (
  outputStream: NodeJS.WriteStream,
  output: string,
): Promise<void> => {
  if (output.length === 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    outputStream.write(output, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

try {
  const invocationDirectory = process.cwd();
  const packageMetadata = await loadMoldeaCliPackageMetadata(packageManifestPath);
  const executionResult = await runMoldeaCli({
    commandLineArguments: process.argv.slice(2),
    invocationDirectory,
    packageMetadata,
    readStdin: readProcessStdin,
    signal: shutdown.signal,
  });

  if (shutdown.receivedSignal() === null) {
    await writeProcessOutput(process.stdout, executionResult.stdout);

    if (shutdown.receivedSignal() === null) {
      await writeProcessOutput(process.stderr, executionResult.stderr);
    }
  }

  // a signal after the output is complete no longer changes the exit code
  process.exitCode = shutdown.exitCode() ?? executionResult.exitCode;
} catch {
  const signalExitCode = shutdown.exitCode();

  if (signalExitCode === null) {
    await writeProcessOutput(
      process.stderr,
      formatMoldeaCliHumanError(createMoldeaCliOwnedError('INTERNAL_ERROR')),
    ).catch(() => undefined);
  }

  process.exitCode = signalExitCode ?? 3;
} finally {
  shutdown.dispose();

  // an open IPC channel to the launcher would keep the process alive
  if (process.connected) process.disconnect();
}
