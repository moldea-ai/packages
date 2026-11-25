import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mergeConfig, type UserConfig } from 'vite';

import { createLibraryConfig } from '../../configs/vite/library.config.js';

import { MOLDEA_CLI_FOUNDATIONAL_PACKAGE_NAMES } from './src/composition/constants.js';
import type { IMoldeaCliPackageMetadata } from './src/package-metadata/index.js';

interface ILocalPackageManifest {
  readonly version: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly engines?: { readonly node?: string };
}

const readManifest = (relativePath: string): ILocalPackageManifest =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as ILocalPackageManifest;

const cli = readManifest('./package.json');
const embeddedMetadata: IMoldeaCliPackageMetadata = {
  dependencies: cli.dependencies,
  installedPackageVersions: Object.fromEntries(
    MOLDEA_CLI_FOUNDATIONAL_PACKAGE_NAMES.map((name) => [
      name,
      readManifest(`../${name.slice('@moldea.ai/'.length)}/package.json`).version,
    ]),
  ),
  supportedNodeRange: cli.engines?.node ?? null,
  version: cli.version,
};

const directory = path.join(import.meta.dirname, 'dist', 'portable');

// keep entries and chunks together so Core can launch either peer by relative URL
const coreEntries = {
  'node-runner': '../core/dist/node-runner.js',
  'analysis-worker': '../core/dist/analysis-worker.js',
};

export default mergeConfig(
  createLibraryConfig({
    entry: { moldea: 'src/bin/index.ts', ...coreEntries },
    isSourceMapEnabled: false,
    platform: 'node',
    rootDirectory: import.meta.dirname,
  }),
  {
    define: { MOLDEA_PORTABLE_PACKAGE_METADATA: JSON.stringify(embeddedMetadata) },
    build: {
      emptyOutDir: true,
      license: { fileName: 'LICENSES.md' },
      outDir: directory,
      rolldownOptions: {
        platform: 'node',
        output: {
          chunkFileNames: 'chunk-[hash].mjs',
          entryFileNames: '[name].mjs',
          hashCharacters: 'hex',
          comments: false,
          // the TypeScript compiler is CommonJS and reads its own module path at load time
          banner: (chunk) =>
            Object.keys(chunk.modules).some((id) =>
              /[\\/]typescript[\\/]lib[\\/]typescript\.js$/u.test(id),
            )
              ? 'const __filename = import.meta.filename; const __dirname = import.meta.dirname;'
              : '',
        },
        plugins: [
          {
            name: 'portable-core-entry-urls',
            renderChunk(code) {
              const rewritten = code.replace(
                /import\.meta\.resolve\((['"])#moldea-core-(runner|analysis-worker)\1\)/gu,
                (_, _quote: string, entry: string) =>
                  `new URL("./${entry === 'runner' ? 'node-runner' : entry}.mjs", import.meta.url).href`,
              );
              return rewritten === code ? null : { code: rewritten, map: null };
            },
            writeBundle: {
              order: 'post',
              async handler() {
                const noticesPath = path.join(directory, 'LICENSES.md');
                const licenses = await Promise.all(
                  ['cli', 'core', 'repository', 'repository-fs'].map(async (project) => {
                    const license = await readFile(
                      path.resolve(import.meta.dirname, '..', project, 'LICENSE'),
                      'utf8',
                    );
                    return `## @moldea.ai/${project}\n\n${license.trimEnd()}\n`;
                  }),
                );
                const [notices, typescriptNotices] = await Promise.all([
                  readFile(noticesPath, 'utf8'),
                  readFile(
                    new URL(
                      '../core/node_modules/typescript/ThirdPartyNoticeText.txt',
                      import.meta.url,
                    ),
                    'utf8',
                  ),
                ]);
                await writeFile(
                  noticesPath,
                  `${notices.trimEnd()}\n\n${licenses.join('\n')}\n## TypeScript third-party notices\n\n${typescriptNotices.trimEnd()}\n`,
                );
                const files = (await readdir(directory)).sort();
                const sums = await Promise.all(
                  files.map(async (file) => {
                    const bytes = await readFile(path.join(directory, file));
                    return `${createHash('sha256').update(bytes).digest('hex')}  ${file}`;
                  }),
                );
                await writeFile(path.join(directory, 'SHA256SUMS'), `${sums.join('\n')}\n`);
              },
            },
          },
        ],
      },
    },
  } satisfies UserConfig,
);
