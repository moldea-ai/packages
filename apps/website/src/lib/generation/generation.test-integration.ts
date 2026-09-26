// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import type { IRuntimeCompatibilityMatrix } from '../../../../../scripts/runtime-compatibility/types.ts';
import type { IWebsiteModel } from '../model/types.ts';
import { createRuntimeCompatibilityPublication } from '../runtime-compatibility-publication/index.ts';
import { getCapabilityShowcase } from '../capabilities/index.ts';

import {
  buildAdapterPages,
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
  test('discovers the current visitor-facing implementation set and package families', () => {
    const model = getCurrentWebsiteModel();

    expect(model.packages.map(({ name }) => name)).toStrictEqual([
      '@moldea.ai/adapter-anthropic',
      '@moldea.ai/adapter-claude-agent-sdk',
      '@moldea.ai/adapter-cloudflare-agents',
      '@moldea.ai/adapter-eve',
      '@moldea.ai/adapter-google-genai',
      '@moldea.ai/adapter-langchain',
      '@moldea.ai/adapter-langgraph',
      '@moldea.ai/adapter-openai',
      '@moldea.ai/adapter-openai-agents-sdk',
      '@moldea.ai/adapter-vercel-ai-sdk',
      '@moldea.ai/cli',
      '@moldea.ai/core',
      '@moldea.ai/repository',
      '@moldea.ai/repository-fs',
    ]);
    expect(model.packages.find(({ slug }) => slug === 'adapter-openai')?.family).toBe(
      'runtime-adapters',
    );
    expect(model.packages.find(({ slug }) => slug === 'adapter-claude-agent-sdk')?.family).toBe(
      'runtime-adapters',
    );
    expect(model.packages.find(({ slug }) => slug === 'adapter-openai-agents-sdk')?.family).toBe(
      'runtime-adapters',
    );
    expect(model.packages.find(({ slug }) => slug === 'adapter-cloudflare-agents')?.family).toBe(
      'runtime-adapters',
    );
    expect(model.packages.find(({ slug }) => slug === 'adapter-eve')?.family).toBe(
      'runtime-adapters',
    );
    expect(model.packages.find(({ slug }) => slug === 'adapter-langchain')?.family).toBe(
      'runtime-adapters',
    );
    expect(model.packages.find(({ slug }) => slug === 'adapter-langgraph')?.family).toBe(
      'runtime-adapters',
    );
    expect(model.packages.find(({ slug }) => slug === 'adapter-vercel-ai-sdk')?.family).toBe(
      'runtime-adapters',
    );
    expect(model.packages.find(({ slug }) => slug === 'adapter-anthropic')?.family).toBe(
      'runtime-adapters',
    );
    expect(model.packages.find(({ slug }) => slug === 'adapter-google-genai')?.family).toBe(
      'runtime-adapters',
    );
    expect(
      model.packages
        .filter(({ family }) => family === 'skill-core-tooling')
        .map(({ slug }) => slug),
    ).toStrictEqual(['cli', 'core', 'repository', 'repository-fs']);
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

describe('adapter and route generation', () => {
  test('preserves available implementations with supported qualified targets', () => {
    const model = getCurrentWebsiteModel();
    const custom = model.adapters.find(({ id }) => id === 'custom');
    const openAi = model.adapters.find(({ id }) => id === 'openai');
    const anthropic = model.adapters.find(({ id }) => id === 'anthropic');

    expect(custom).toMatchObject({
      implementedPackageSlug: null,
      entry: { implementationStatus: 'available', implementation: { kind: 'built-in' } },
    });
    expect(custom?.entry.targets?.[0]?.qualificationEvidence).toStrictEqual({
      url: 'https://skill.moldea.ai/evidence/qualification/custom/custom/',
    });
    expect(openAi).toMatchObject({
      implementedPackageSlug: 'adapter-openai',
      entry: {
        implementationStatus: 'available',
        targets: [
          {
            maturity: 'supported',
            qualificationEvidence: {
              url: 'https://skill.moldea.ai/evidence/qualification/openai/typescript-responses-api-7/',
            },
          },
        ],
      },
    });
    expect(anthropic).toMatchObject({
      implementedPackageSlug: 'adapter-anthropic',
      entry: {
        implementationStatus: 'available',
        targets: [
          {
            maturity: 'supported',
            qualificationEvidence: {
              url: 'https://skill.moldea.ai/evidence/qualification/anthropic/typescript-messages-api-0-117/',
            },
          },
        ],
      },
    });
  });

  test('rejects an available package-backed adapter without an implemented package', () => {
    const matrix: IRuntimeCompatibilityMatrix = {
      version: 2,
      adapters: {
        missing: {
          implementation: {
            distribution: 'public',
            kind: 'package',
            package: '@moldea.ai/adapter-missing',
          },
          implementationStatus: 'available',
        },
      },
    };

    expect(() => buildAdapterPages(createRuntimeCompatibilityPublication(matrix, {}), [])).toThrow(
      'Available adapter missing has no implemented public package.',
    );
  });

  test('uses one combined publication for adapter pages and the machine route', () => {
    const model = getCurrentWebsiteModel();

    expect(model.runtimeCompatibilityPublication).toMatchObject({
      matrixVersion: 2,
      schemaVersion: 1,
    });
    expect(model.adapters.map(({ id, entry }) => [id, entry])).toStrictEqual(
      Object.entries(model.runtimeCompatibilityPublication.adapters),
    );
    expect(model.routes).toContain('/compatibility/runtimes.json');
  });

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

    expect(() => createRouteManifest([first, second], [], model.gettingStarted)).toThrow(
      'Two public content items resolve to /collision/.',
    );
  });
});

describe('createLlmsText', () => {
  test('is deterministic under reversed source enumeration', () => {
    const model = getCurrentWebsiteModel();

    expect(
      createLlmsText(
        [...model.packages].reverse(),
        [...model.adapters].reverse(),
        model.repositoryFormatSpecification,
        model.gettingStarted,
      ),
    ).toBe(
      createLlmsText(
        model.packages,
        model.adapters,
        model.repositoryFormatSpecification,
        model.gettingStarted,
      ),
    );
  });

  test('represents every public package and canonical adapter without exposing the website package', () => {
    const model = getCurrentWebsiteModel();
    const text = createLlmsText(
      model.packages,
      model.adapters,
      model.repositoryFormatSpecification,
      model.gettingStarted,
    );
    const lines = text.split('\n');

    for (const packageModel of model.packages) {
      const overview = packageModel.documents.find(({ slug }) => slug === '');

      expect(text).toContain(
        `- [${packageModel.name}](${packageModel.route}): ${overview?.description}`,
      );
    }

    for (const adapter of model.adapters) {
      const line = lines.find((candidate) => candidate.startsWith(`- [${adapter.id}](`));

      expect(line).toContain(`): ${adapter.entry.implementationStatus};`);
      for (const target of adapter.entry.targets ?? []) {
        expect(line).toContain(`${target.id}: ${target.maturity}`);
      }
    }

    const internalLinks = [...text.matchAll(/\[[^\]]+\]\((\/[^)\s]+)\)/g)].map((match) => match[1]);

    expect(internalLinks.length).toBeGreaterThan(0);
    for (const route of internalLinks) expect(model.routes).toContain(route);
    expect(text).not.toContain('@moldea.ai/packages-website');
    expect(text).toContain('available; built into @moldea.ai/core; custom: supported');
    expect(text).toContain('typescript-messages-api-0-117: supported');
    expect(text).toContain('typescript-responses-api-7: supported');
    expect(text).toContain(
      `[Repository Format specification](${model.repositoryFormatSpecification.route})`,
    );
  });
});

describe('createSearchRecords', () => {
  test('indexes visible coverage and illustrations while retaining the complete internal catalog', () => {
    const model = getCurrentWebsiteModel();
    expect(model.routes.filter((route) => route === '/capabilities/')).toStrictEqual([
      '/capabilities/',
    ]);
    expect(model.llmsText).toContain('[Capabilities](/capabilities/)');
    const showcase = getCapabilityShowcase(model.capabilities);
    expect(showcase).toHaveLength(6);
    const examples = showcase.flatMap((section) => section.examples);
    expect(examples).toHaveLength(31);
    expect(
      showcase.find(({ group }) => group.id === 'agents')?.examples.map(({ id }) => id),
    ).toStrictEqual([
      'variable-undeclared',
      'mirror-stale',
      'agent-identity',
      'tool-implementation-missing',
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
    expect(capabilityRecords).toHaveLength(38);
    for (const example of model.capabilities.cases) {
      if (examples.some((entry) => entry.id === example.id)) continue;
      expect(capabilityRecords.some(({ route }) => route === `/capabilities/#${example.id}`)).toBe(
        false,
      );
    }
    expect(JSON.stringify(capabilityRecords)).not.toContain('export async function');
    expect(JSON.stringify(capabilityRecords)).not.toContain('evidenceExcerpt');
  });
  test('publishes one combined runtime directory and keeps the JSON handoff', () => {
    const model = getCurrentWebsiteModel();
    const directory = model.searchRecords.filter(({ route }) => route === '/adapters/');
    expect(directory).toHaveLength(1);
    expect(directory[0].title).toBe('Runtime adapters and compatibility');
    expect(directory[0].searchText).toContain('compatibility');
    expect(model.searchRecords.some(({ route }) => route === '/compatibility/')).toBe(false);
    expect(model.llmsText).toContain('[Runtime adapters and compatibility](/adapters/)');
    expect(model.llmsText).toContain('(/compatibility/runtimes.json)');
    expect(model.llmsText).not.toContain('(/compatibility/)');
  });
  test('represents every public package and canonical adapter', () => {
    const model = getCurrentWebsiteModel();
    const searchRecords = createSearchRecords(
      model.packages,
      model.adapters,
      model.repositoryFormatSpecification,
      model.gettingStarted,
      model.discoveryCopy,
      model.capabilities,
    );

    for (const packageModel of model.packages) {
      expect(
        searchRecords.some(
          (record) =>
            record.title.includes(packageModel.name) ||
            record.searchText.includes(packageModel.name),
        ),
      ).toBe(true);
    }

    for (const adapter of model.adapters) {
      expect(searchRecords.some(({ route }) => route === adapter.route)).toBe(true);
    }

    expect(
      searchRecords.some(({ route }) => route === model.repositoryFormatSpecification.route),
    ).toBe(true);

    expect(searchRecords.some(({ searchText }) => searchText.includes('supported'))).toBe(true);
    expect(JSON.stringify(searchRecords)).not.toContain('@moldea.ai/packages-website');
  });

  test('is deterministic under reversed source enumeration', () => {
    const model = getCurrentWebsiteModel();

    expect(
      createSearchRecords(
        [...model.packages].reverse(),
        [...model.adapters].reverse(),
        model.repositoryFormatSpecification,
        model.gettingStarted,
        model.discoveryCopy,
        model.capabilities,
      ),
    ).toStrictEqual(
      createSearchRecords(
        model.packages,
        model.adapters,
        model.repositoryFormatSpecification,
        model.gettingStarted,
        model.discoveryCopy,
        model.capabilities,
      ),
    );
  });
});

test('publishes one authored guide across routes, search, and llms with Skill and Cloud handoffs', () => {
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
  expect(guide.markdown).toContain('[moldea Cloud](https://moldea.ai)');
  expect(model.llmsText).toContain(`[${guide.title}](${guide.route}): ${guide.description}`);
  expect(model.llmsText).toContain('[moldea Agent Skill](https://skill.moldea.ai/)');
  expect(model.searchRecords.every(({ route }) => route.startsWith('/'))).toBe(true);
  expect(() =>
    createRouteManifest(
      [],
      [{ ...model.adapters[0], implementedPackageSlug: null, route: guide.route }],
      guide,
    ),
  ).toThrow('Two public content items resolve to /getting-started/.');
});

test('keeps Website UI documentation out of every public discovery surface', () => {
  const model = getCurrentWebsiteModel();

  expect(model.packages.some(({ name }) => name === '@moldea.ai/website-ui')).toBe(false);
  expect(model.routes.some((route) => route.startsWith('/packages/website-ui/'))).toBe(false);
  expect(model.searchRecords.some(({ route }) => route.startsWith('/packages/website-ui/'))).toBe(
    false,
  );
  expect(model.llmsText).not.toContain('@moldea.ai/website-ui');
  expect(model.llmsText).not.toContain('Website Foundations');
  expect(model.discoveryCopy.packages).not.toHaveProperty('@moldea.ai/website-ui');
});

test('keeps display metadata separate from canonical compatibility and model generation deterministic', async () => {
  const model = getCurrentWebsiteModel();
  expect(model).toStrictEqual(await createWebsiteModel());
  expect(model.capabilities.cases).toHaveLength(151);
  expect(model.capabilities.runtimeTargets).toHaveLength(14);
  expect(model.routes).toContain('/capabilities/');
  expect(model.inspectionExample.map(({ result }) => result.valid)).toStrictEqual([
    true,
    false,
    true,
  ]);
  expect(model.instructionExample.result.valid).toBe(false);
  expect(model.instructionExample.result.diagnostics.map(({ code }) => code)).toStrictEqual([
    'MOLDEA_TOOL_IMPLEMENTATION_MISSING',
  ]);
  const canonical = structuredClone(model.runtimeCompatibilityPublication);
  model.discoveryCopy.adapters.openai.name = 'A display-only label';
  expect(model.runtimeCompatibilityPublication).toStrictEqual(canonical);
  expect(JSON.stringify(canonical)).not.toContain('Responses API integration');
  const openAiRecord = model.searchRecords.find(({ route }) => route === '/adapters/openai/');
  expect(openAiRecord?.searchText).toContain('Responses API');
  expect(openAiRecord?.searchText).toContain('typescript-responses-api-7');
});
