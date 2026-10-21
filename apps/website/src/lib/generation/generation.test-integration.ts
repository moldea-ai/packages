// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { RUNTIME_CATALOG } from '@moldea.ai/website-ui/runtime-catalog';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import type { IWebsiteModel } from '../model/types.ts';
import { RETIRED_RUNTIME_ROUTES } from '../redirects/index.ts';
import { getCapabilityShowcase } from '../capabilities/index.ts';

import {
  createLlmsText,
  createRouteManifest,
  createSearchRecords,
  createWebsiteModel,
  discoverPublicPackages,
} from './generation.ts';

const temporaryDirectories: string[] = [];
let currentWebsiteModel: IWebsiteModel;

beforeAll(async () => {
  currentWebsiteModel = await createWebsiteModel();
});

const getCurrentWebsiteModel = (): IWebsiteModel => structuredClone(currentWebsiteModel);

const createTemporaryRepository = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'moldea-website-generation-'));
  temporaryDirectories.push(directory);
  mkdirSync(join(directory, 'projects'), { recursive: true });

  return directory;
};

const writeProject = (
  repositoryRoot: string,
  slug: string,
  options: {
    dependencies?: Record<string, string>;
    documents?: Record<string, string>;
    hasSource?: boolean;
    isPrivate?: boolean;
  } = {},
): void => {
  const projectDirectory = join(repositoryRoot, 'projects', slug);
  mkdirSync(projectDirectory, { recursive: true });
  writeFileSync(
    join(projectDirectory, 'package.json'),
    JSON.stringify({
      name: `@moldea.ai/${slug}`,
      version: '1.0.0',
      description: `${slug} package`,
      private: options.isPrivate,
      exports: {},
      dependencies: options.dependencies,
      publishConfig: { access: 'public' },
      repository: {
        type: 'git',
        url: 'git+https://github.com/moldea-ai/packages.git',
        directory: `projects/${slug}`,
      },
    }),
  );

  if (options.hasSource !== false) {
    mkdirSync(join(projectDirectory, 'src'), { recursive: true });
    writeFileSync(join(projectDirectory, 'src', 'index.ts'), 'export const implemented = true;\n');
  }

  if (options.documents) {
    for (const [relativePath, title] of Object.entries(options.documents)) {
      const path = join(projectDirectory, 'docs', relativePath);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(
        path,
        `---\ntitle: ${title}\ndescription: ${title} documentation.\norder: 0\n---\n\n# ${title}\n`,
      );
    }
  }
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('discoverPublicPackages', () => {
  test('discovers exactly the four visitor-facing packages', () => {
    expect(getCurrentWebsiteModel().packages.map(({ name }) => name)).toStrictEqual([
      '@moldea.ai/cli',
      '@moldea.ai/core',
      '@moldea.ai/repository',
      '@moldea.ai/repository-fs',
    ]);
  });

  test('excludes Website UI before reading its repository-only documentation', () => {
    const repositoryRoot = createTemporaryRepository();
    writeProject(repositoryRoot, 'website-ui');

    expect(discoverPublicPackages(repositoryRoot)).toStrictEqual([]);
  });

  test('excludes private and source-less projects before requiring public documentation', () => {
    const repositoryRoot = createTemporaryRepository();
    writeProject(repositoryRoot, 'public-package', { documents: { 'index.md': 'Public' } });
    writeProject(repositoryRoot, 'private-package', { isPrivate: true });
    writeProject(repositoryRoot, 'planned-package', {
      documents: { 'index.md': 'Planned' },
      hasSource: false,
    });

    expect(discoverPublicPackages(repositoryRoot).map(({ slug }) => slug)).toStrictEqual([
      'public-package',
    ]);
  });

  test('resolves public API types from private workspace packages without built declarations', () => {
    const repositoryRoot = createTemporaryRepository();
    const sharedPackageDirectory = join(repositoryRoot, 'packages', 'shared-contracts');
    mkdirSync(join(sharedPackageDirectory, 'src'), { recursive: true });
    writeFileSync(
      join(sharedPackageDirectory, 'package.json'),
      JSON.stringify({
        name: '@moldea.ai/shared-contracts',
        private: true,
        exports: {
          '.': {
            types: './dist/index.d.ts',
            import: './dist/index.js',
          },
        },
      }),
    );
    writeFileSync(
      join(sharedPackageDirectory, 'src', 'index.ts'),
      'export interface ISharedContract { name: string; }\n',
    );

    writeProject(repositoryRoot, 'public-package', {
      documents: { 'index.md': 'Public' },
    });
    const publicPackageDirectory = join(repositoryRoot, 'projects', 'public-package');
    const publicPackageManifest = JSON.parse(
      readFileSync(join(publicPackageDirectory, 'package.json'), 'utf8'),
    ) as Record<string, unknown>;
    publicPackageManifest.exports = {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
      },
    };
    writeFileSync(
      join(publicPackageDirectory, 'package.json'),
      JSON.stringify(publicPackageManifest),
    );
    writeFileSync(
      join(publicPackageDirectory, 'src', 'index.ts'),
      "import type { ISharedContract } from '@moldea.ai/shared-contracts';\n\nexport type IPublicContract = ISharedContract;\n",
    );

    expect(discoverPublicPackages(repositoryRoot)[0]?.api).toStrictEqual([
      {
        name: '.',
        route: 'api',
        symbols: [
          {
            description: '',
            kind: 'type',
            name: 'IPublicContract',
            signature: 'export type IPublicContract = ISharedContract;',
          },
        ],
      },
    ]);
  });

  test('normalizes Windows line endings in package documentation', () => {
    const repositoryRoot = createTemporaryRepository();
    writeProject(repositoryRoot, 'windows-docs', { documents: { 'index.md': 'Windows docs' } });
    const documentPath = join(repositoryRoot, 'projects', 'windows-docs', 'docs', 'index.md');
    const documentSource = readFileSync(documentPath, 'utf8');
    writeFileSync(documentPath, documentSource.replaceAll('\n', '\r\n'));

    const packageModel = discoverPublicPackages(repositoryRoot)[0];

    expect(packageModel?.documents[0]).toMatchObject({
      markdown: '# Windows docs',
      title: 'Windows docs',
    });
  });

  test('fails when an implemented public project has no package-owned documentation', () => {
    const repositoryRoot = createTemporaryRepository();
    writeProject(repositoryRoot, 'undocumented');

    expect(() => discoverPublicPackages(repositoryRoot)).toThrow(
      '@moldea.ai/undocumented is public and implemented but has no docs directory.',
    );
  });

  test('rejects duplicate documentation routes', () => {
    const repositoryRoot = createTemporaryRepository();
    writeProject(repositoryRoot, 'duplicate-docs', {
      documents: {
        'a.md': 'A',
        'a/index.md': 'Nested A',
        'index.md': 'Overview',
      },
    });

    expect(() => discoverPublicPackages(repositoryRoot)).toThrow(
      '@moldea.ai/duplicate-docs documentation resolves to duplicate routes.',
    );
  });

  test('derives dependency and dependent relationships from manifests', () => {
    const repositoryRoot = createTemporaryRepository();
    writeProject(repositoryRoot, 'foundation', { documents: { 'index.md': 'Foundation' } });
    writeProject(repositoryRoot, 'consumer', {
      dependencies: { '@moldea.ai/foundation': 'workspace:^1.0.0' },
      documents: { 'index.md': 'Consumer' },
    });

    const packages = discoverPublicPackages(repositoryRoot);

    expect(packages.find(({ slug }) => slug === 'consumer')?.dependencies).toStrictEqual([
      '@moldea.ai/foundation',
    ]);
    expect(packages.find(({ slug }) => slug === 'foundation')?.dependents).toStrictEqual([
      '@moldea.ai/consumer',
    ]);
  });
});

describe('route generation', () => {
  test('rejects two package documents resolving to one route', () => {
    const model = getCurrentWebsiteModel();
    const first = {
      ...model.packages[0],
      api: [],
      documents: [{ ...model.packages[0].documents[0], route: '/collision/' }],
    };
    const second = {
      ...model.packages[1],
      api: [],
      documents: [{ ...model.packages[1].documents[0], route: '/collision/' }],
    };

    expect(() => createRouteManifest([first, second], model.gettingStarted)).toThrow(
      'Two public content items resolve to /collision/.',
    );
  });
});

test('keeps machine discovery deterministic and represents every package and runtime label', () => {
  const model = getCurrentWebsiteModel();
  const text = createLlmsText(
    model.packages,
    model.repositoryFormatSpecification,
    model.gettingStarted,
  );
  expect(
    createLlmsText(
      [...model.packages].reverse(),
      model.repositoryFormatSpecification,
      model.gettingStarted,
    ),
  ).toBe(text);
  for (const pkg of model.packages)
    expect(text).toContain(
      `[${pkg.name}](${pkg.route}): ${pkg.documents.find(({ slug }) => slug === '')?.description}`,
    );
  for (const runtime of RUNTIME_CATALOG)
    expect(text).toContain(`[${runtime.displayName}](/runtimes/#${runtime.id})`);
  for (const [, route] of text.matchAll(/\[[^\]]+\]\((\/[^)\s]+)\)/g))
    expect(model.routes).toContain(route.split('#')[0]);
  expect(text).not.toMatch(
    /@moldea.ai\/(?:packages-website|adapter-|website-ui)|\/compatibility\//,
  );
});

describe('createSearchRecords', () => {
  test('indexes category coverage and illustrations while retaining the complete internal catalog', () => {
    const model = getCurrentWebsiteModel();
    expect(model.routes.filter((route) => route === '/capabilities/')).toStrictEqual([
      '/capabilities/',
    ]);
    expect(model.llmsText).toContain('[Capabilities](/capabilities/)');
    const showcase = getCapabilityShowcase(model.capabilities);
    expect(showcase).toHaveLength(6);
    const examples = showcase.flatMap((section) => section.examples);
    expect(examples).toHaveLength(model.capabilities.cases.length);
    expect(
      showcase
        .find(({ group }) => group.id === 'agents')
        ?.examples.slice(0, 4)
        .map(({ id }) => id),
    ).toStrictEqual([
      'mirror-stale',
      'tool-implementation-missing',
      'variable-undeclared',
      'agent-context-present',
    ]);
    for (const example of examples) {
      const records = model.searchRecords.filter(
        ({ route }) => route === `/capabilities/#${example.id}`,
      );
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ title: example.title, description: example.description });
      expect(records[0].searchText).toContain(example.operation);
      expect(records[0].searchText).toContain(example.packageName);
    }
    for (const group of model.capabilities.groups) {
      expect(
        model.searchRecords.filter(({ route }) => route === `/capabilities/#${group.id}`),
      ).toHaveLength(1);
      const record = model.searchRecords.find(
        ({ route }) => route === `/capabilities/#${group.id}`,
      )!;
      for (const capability of group.coverage)
        expect(record.searchText).toContain(capability.replaceAll(',', ''));
    }
    const capabilityRecords = model.searchRecords.filter(({ route }) =>
      route.startsWith('/capabilities/'),
    );
    expect(capabilityRecords).toHaveLength(model.capabilities.cases.length + 7);
    expect(new Set(examples.map(({ id }) => id))).toStrictEqual(
      new Set(model.capabilities.cases.map(({ id }) => id)),
    );
    expect(JSON.stringify(capabilityRecords)).not.toContain('export async function');
    expect(JSON.stringify(capabilityRecords)).not.toContain('boundaryVersion');
  });
  test('indexes runtime labels without retaining retired discovery routes', () => {
    const model = getCurrentWebsiteModel();
    for (const runtime of RUNTIME_CATALOG)
      expect(
        model.searchRecords.filter(({ route }) => route === `/runtimes/#${runtime.id}`),
      ).toHaveLength(1);
    expect(model.searchRecords.filter(({ route }) => route === '/runtimes/')).toHaveLength(1);
    expect(model.searchRecords.some(({ route }) => RETIRED_RUNTIME_ROUTES.includes(route))).toBe(
      false,
    );
    expect(model.routes).toEqual(expect.arrayContaining(RETIRED_RUNTIME_ROUTES));
    expect(model.routes).not.toContain('/compatibility/runtimes.json');
  });
  test('keeps search deterministic when packages are discovered in reverse order', () => {
    const model = getCurrentWebsiteModel();
    expect(
      createSearchRecords(
        [...model.packages].reverse(),
        model.repositoryFormatSpecification,
        model.gettingStarted,
        model.discoveryCopy,
        model.capabilities,
      ),
    ).toStrictEqual(model.searchRecords);
  });
});

test('uses the authored guide and excludes Website UI from public discovery', () => {
  const model = getCurrentWebsiteModel();
  const guide = model.gettingStarted;
  expect(guide.route).toBe('/getting-started/');
  expect(guide.sourcePath).toBe('apps/website/content/getting-started.md');
  expect(model.routes.filter((route) => route === guide.route)).toStrictEqual([guide.route]);
  const records = model.searchRecords.filter(({ route }) => route === guide.route);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ title: guide.title, description: guide.description });
  expect(records[0].searchText).toContain('Check an adopted repository locally');
  expect(records[0].searchText).toContain('Collaborate in Cloud');
  expect(model.llmsText).toContain(`[${guide.title}](${guide.route}): ${guide.description}`);
  expect(model.llmsText).toContain('[moldea Agent Skill](https://skill.moldea.ai/)');
  expect(model.gettingStarted.markdown).toContain('[`moldea Cloud`](https://moldea.ai)');
  expect(model.gettingStarted.markdown).toContain(
    '[`moldea Agent Skill`](https://skill.moldea.ai/)',
  );
  expect(
    JSON.stringify({ routes: model.routes, search: model.searchRecords, llms: model.llmsText }),
  ).not.toContain('/packages/website-ui/');
  expect(model.discoveryCopy.packages).not.toHaveProperty('@moldea.ai/website-ui');
});
test('regenerates the same source-backed model with Core 9 examples', async () => {
  const model = getCurrentWebsiteModel();
  expect(await createWebsiteModel()).toStrictEqual(model);
  expect(model.capabilities.cases).toHaveLength(119);
  expect(model.inspectionExample.map(({ result }) => result.valid)).toStrictEqual([
    true,
    false,
    true,
  ]);
  expect(model.instructionExample.result.diagnostics.map(({ code }) => code)).toStrictEqual([
    'MOLDEA_TOOL_IMPLEMENTATION_MISSING',
  ]);
});
