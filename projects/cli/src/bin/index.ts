import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runMoldeaCli } from '../cli-execution/index.js';
import type { IMoldeaCliStdinReader } from '../cli-execution/index.js';
import { loadMoldeaCliPackageMetadata } from '../package-metadata/index.js';
import { createMoldeaCliOwnedError, formatMoldeaCliHumanError } from '../presentation/index.js';
import { createMoldeaCliProcessSignalSession } from '../process-signal/index.js';

const executableDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageManifestPath = path.resolve(executableDirectory, '..', 'package.json');
const signalSession = createMoldeaCliProcessSignalSession();

/** Reads process stdin incrementally without retaining bytes above the requested limit. */
const readProcessStdin: IMoldeaCliStdinReader = async (maxBytes, signal) => {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of process.stdin) {
    if (signal?.aborted) {
      return { bytes: new Uint8Array(), kind: 'completed' };
    }

    const bytes = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : new Uint8Array(chunk);
    totalBytes += bytes.byteLength;

    if (totalBytes > maxBytes) {
      process.stdin.pause();
      return { kind: 'limit-exceeded' };
    }

    chunks.push(bytes);
  }

  return { bytes: Buffer.concat(chunks, totalBytes), kind: 'completed' };
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
    signal: signalSession.signal,
  });

  if (signalSession.hasReceivedSignal) {
    process.exitCode = signalSession.exitCode;
  } else {
    await writeProcessOutput(process.stdout, executionResult.stdout);

    if (!signalSession.hasReceivedSignal) {
      await writeProcessOutput(process.stderr, executionResult.stderr);
    }

    if (!signalSession.hasReceivedSignal) {
      signalSession.completeOutput();
    }

    process.exitCode = signalSession.exitCode ?? executionResult.exitCode;
  }
} catch {
  if (signalSession.hasReceivedSignal) {
    process.exitCode = signalSession.exitCode;
  } else {
    await writeProcessOutput(
      process.stderr,
      formatMoldeaCliHumanError(createMoldeaCliOwnedError('INTERNAL_ERROR')),
    ).catch(() => undefined);
    signalSession.completeOutput();
    process.exitCode = 3;
  }
} finally {
  signalSession.dispose();
}
