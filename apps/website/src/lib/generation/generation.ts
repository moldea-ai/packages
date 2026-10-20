import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import {
  buildLlmsText,
  escapeMarkdownLabel,
  normalizeDescription,
  type ILlmsTextLink,
} from 'jg-site';

import { RUNTIME_CATALOG } from '@moldea.ai/website-ui/runtime-catalog';

import { RETIRED_RUNTIME_ROUTES } from '../redirects/index.ts';
import { generateApiReference } from './api-reference.ts';
import type {
  IPackageDocument,
  IPublicPackage,
  ISearchRecord,
  IWebsiteModel,
} from '../model/types.ts';
import {
  loadRepositoryFormatSpecification,
  type IRepositoryFormatSpecification,
} from '../repository-format-specification/index.ts';
import {
  DISCOVERY_COPY,
  validateDiscoveryCopy,
  type IDiscoveryCopy,
} from '../discovery-copy/index.ts';
import { createInspectionExample } from '../inspection-example/index.ts';
import { createInstructionExample } from '../instruction-example/index.ts';
import {
  createCapabilities,
  getCapabilityOutcome,
  getCapabilityShowcase,
  type ICapabilities,
} from '../capabilities/index.ts';

const REPOSITORY_URL = 'https://github.com/moldea-ai/packages';
const EXCLUDED_DIRECTORY_NAMES = new Set(['_archive', '_archives', '_backup', '_backups']);
const GENERATED_NOTICE =
  'Generated from project manifests, package-owned documentation, public exports, specifications/repository-format.md, website-owned content and display metadata, and real Core, reader, and CLI operations on synthetic examples. Do not edit generated output.';

const PackageManifestSchema = z.object({
  bin: z.record(z.string(), z.string()).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  description: z.string().min(1),
  engines: z.record(z.string(), z.string()).optional(),
  exports: z.record(
    z.string(),
    z.strictObject({
      default: z.string().optional(),
      import: z.string().optional(),
      style: z.string().optional(),
      types: z.string().optional(),
    }),
  ),
  name: z.string().regex(/^@moldea\.ai\/[a-z0-9-]+$/),
  private: z.boolean().optional(),
  publishConfig: z
    .strictObject({
      access: z.literal('public'),
    })
    .optional(),
  repository: z.strictObject({
    directory: z.string(),
    type: z.literal('git'),
    url: z.string(),
  }),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
});

const DocumentFrontmatterSchema = z.strictObject({
  description: z.string().min(1),
  navigationTitle: z.string().min(1).optional(),
  order: z.number().int().nonnegative(),
  title: z.string().min(1),
});

const getRepositoryRoot = (): string => {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
};

const parseJsonFile = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const parseDocument = (
  path: string,
  sourceDirectory: string,
  packageRoute: string,
  repositoryRoot: string,
): IPackageDocument => {
  const source = readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(source);

  if (!match) {
    throw new Error(`${relative(repositoryRoot, path)} must start with YAML frontmatter.`);
  }

  const metadata = DocumentFrontmatterSchema.parse(parseYaml(match[1]));
  const relativeDocumentPath = relative(sourceDirectory, path);
  const sourceSlug = relativeDocumentPath.replaceAll(sep, '/').replace(/\.md$/, '');
  const slug = sourceSlug === 'index' ? '' : sourceSlug.replace(/\/index$/, '');
  const route = slug ? `${packageRoute}${slug}/` : packageRoute;

  return {
    description: metadata.description,
    markdown: match[2].trim(),
    navigationTitle: metadata.navigationTitle ?? metadata.title,
    order: metadata.order,
    route,
    slug,
    sourcePath: relative(repositoryRoot, path).replaceAll(sep, '/'),
    title: metadata.title,
  };
};

const listMarkdownFiles = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !EXCLUDED_DIRECTORY_NAMES.has(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  return entries.flatMap((entry): string[] => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return listMarkdownFiles(path);
    if (entry.isFile() && entry.name.endsWith('.md')) return [path];

    return [];
  });
};

/** Discovers visitor-facing public projects and validates their package-owned documentation. */
export const discoverPublicPackages = (repositoryRoot: string): IPublicPackage[] => {
  const projectsDirectory = join(repositoryRoot, 'projects');
  const discovered = readdirSync(projectsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !EXCLUDED_DIRECTORY_NAMES.has(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry): IPublicPackage[] => {
      const projectDirectory = join(projectsDirectory, entry.name);
      const manifestPath = join(projectDirectory, 'package.json');

      if (!existsSync(manifestPath) || entry.name === 'website-ui') return [];

      const manifest = PackageManifestSchema.parse(parseJsonFile(manifestPath));

      if (manifest.private === true || manifest.publishConfig?.access !== 'public') return [];
      // shared website implementation remains documented in its repository, not on this site
      if (manifest.name === '@moldea.ai/website-ui') return [];
      if (!existsSync(join(projectDirectory, 'src'))) return [];
      if (manifest.repository.directory !== `projects/${entry.name}`) {
        throw new Error(`${manifest.name} repository.directory contradicts its project directory.`);
      }

      const expectedName = `@moldea.ai/${entry.name}`;

      if (manifest.name !== expectedName) {
        throw new Error(`${manifest.name} contradicts project identity ${expectedName}.`);
      }

      const route = `/packages/${entry.name}/`;

      const docsDirectory = join(projectDirectory, 'docs');

      if (!existsSync(docsDirectory)) {
        throw new Error(`${manifest.name} is public and implemented but has no docs directory.`);
      }

      const documents = listMarkdownFiles(docsDirectory)
        .map((path) => parseDocument(path, join(projectDirectory, 'docs'), route, repositoryRoot))
        .sort((left, right) => left.order - right.order || left.route.localeCompare(right.route));

      if (!documents.some((document) => document.slug === '')) {
        throw new Error(`${manifest.name} documentation has no index.md.`);
      }

      const routeSet = new Set(documents.map(({ route }) => route));

      if (routeSet.size !== documents.length) {
        throw new Error(`${manifest.name} documentation resolves to duplicate routes.`);
      }

      const dependencies = Object.keys(manifest.dependencies ?? {})
        .filter((name) => name.startsWith('@moldea.ai/'))
        .sort();
      return [
        {
          api: generateApiReference(projectDirectory, manifest.exports),
          dependencies,
          dependents: [],
          description: manifest.description,
          documents,
          engines: manifest.engines ?? {},
          name: manifest.name,
          npmUrl: `https://www.npmjs.com/package/${manifest.name}`,
          repositoryDirectory: manifest.repository.directory,
          route,
          slug: entry.name,
          sourceUrl: `${REPOSITORY_URL}/tree/main/${manifest.repository.directory}`,
          version: manifest.version,
        },
      ];
    });

  const packageByName = new Map(
    discovered.map((packageModel) => [packageModel.name, packageModel]),
  );

  for (const packageModel of discovered) {
    for (const dependency of packageModel.dependencies) {
      const dependencyModel = packageByName.get(dependency);

      if (dependencyModel) dependencyModel.dependents.push(packageModel.name);
    }
  }

  for (const packageModel of discovered) packageModel.dependents.sort();

  return discovered;
};

/** Creates the unique deterministic route manifest for generated and authored pages. */
export const createRouteManifest = (
  packages: IPublicPackage[],
  gettingStarted: IPackageDocument,
): string[] => {
  const routes = new Set<string>();
  const addRoute = (route: string): void => {
    if (routes.has(route)) throw new Error(`Two public content items resolve to ${route}.`);
    routes.add(route);
  };

  for (const route of [
    '/',
    '/404.html',
    '/runtimes/',
    '/capabilities/',
    '/llms.txt',
    '/packages/',
    '/repository-format/',
    '/robots.txt',
    '/search/',
    '/search-index.json',
  ]) {
    addRoute(route);
  }

  addRoute(gettingStarted.route);

  for (const packageModel of packages) {
    for (const document of packageModel.documents) addRoute(document.route);
    if (packageModel.api.length > 0) addRoute(`${packageModel.route}api/`);
  }

  for (const route of RETIRED_RUNTIME_ROUTES) addRoute(route);

  return [...routes].sort();
};

const normalizeSearchText = (source: string): string =>
  source
    .replaceAll(/[^\p{L}\p{N}@._/:-]+/gu, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

/** Creates deterministic public search records without maintaining a parallel content inventory. */
export const createSearchRecords = (
  packages: IPublicPackage[],
  specification: IRepositoryFormatSpecification,
  gettingStarted: IPackageDocument,
  discoveryCopy: IDiscoveryCopy,
  capabilities: ICapabilities,
): ISearchRecord[] => {
  const recordsByRoute = new Map<string, ISearchRecord>();

  for (const packageModel of packages) {
    for (const document of packageModel.documents) {
      recordsByRoute.set(document.route, {
        description: document.description,
        route: document.route,
        searchText: normalizeSearchText(
          [
            packageModel.name,
            packageModel.description,
            discoveryCopy.packages[packageModel.name].name,
            discoveryCopy.packages[packageModel.name].description,
            document.navigationTitle,
            document.markdown,
          ].join(' '),
        ),
        title:
          document.slug === '' ? packageModel.name : `${document.title} · ${packageModel.name}`,
      });
    }

    if (packageModel.api.length > 0) {
      recordsByRoute.set(`${packageModel.route}api/`, {
        description: `Public exports and signatures for ${packageModel.name}.`,
        route: `${packageModel.route}api/`,
        searchText: normalizeSearchText(
          packageModel.api
            .flatMap((entrypoint) => [
              entrypoint.name,
              ...entrypoint.symbols.flatMap((symbol) => [
                symbol.name,
                symbol.kind,
                symbol.description,
                symbol.signature,
              ]),
            ])
            .join(' '),
        ),
        title: `${packageModel.name} API reference`,
      });
    }
  }

  recordsByRoute.set(specification.route, {
    description: specification.description,
    route: specification.route,
    searchText: normalizeSearchText(
      [
        specification.title,
        `Repository Format version ${specification.formatVersion}`,
        specification.markdown,
      ].join(' '),
    ),
    title: specification.title,
  });

  recordsByRoute.set(gettingStarted.route, {
    description: gettingStarted.description,
    route: gettingStarted.route,
    searchText: normalizeSearchText([gettingStarted.title, gettingStarted.markdown].join(' ')),
    title: gettingStarted.title,
  });

  recordsByRoute.set('/runtimes/', {
    route: '/runtimes/',
    title: 'Runtimes',
    description: 'Runtime labels, declared binding checks, coverage, and agent guidance.',
    searchText:
      'Runtime labels binding file existence export syntax coverage agent SDK type definitions',
  });
  for (const runtime of RUNTIME_CATALOG) {
    const route = `/runtimes/#${runtime.id}`;
    recordsByRoute.set(route, {
      route,
      title: runtime.displayName,
      description: 'A runtime label selects guidance for your coding agent.',
      searchText: `${runtime.displayName} ${runtime.id} runtime label guidance`,
    });
  }

  recordsByRoute.set('/capabilities/', {
    route: '/capabilities/',
    title: 'Capabilities',
    description:
      'Executable examples of project context, structural checks, decisions, and declared binding checks.',
    searchText:
      'Capabilities project context knowledge structure decisions agents binding coverage repository access command line deterministic checks',
  });
  for (const group of capabilities.groups) {
    const route = `/capabilities/#${group.id}`;
    recordsByRoute.set(route, {
      route,
      title: group.title,
      description: group.description,
      searchText: normalizeSearchText(
        [group.title, group.description, ...group.coverage].join(' '),
      ),
    });
  }
  for (const example of getCapabilityShowcase(capabilities).flatMap(({ examples }) => examples)) {
    const route = `/capabilities/#${example.id}`;
    const outcome = getCapabilityOutcome(example);
    recordsByRoute.set(route, {
      route,
      title: example.title,
      description: example.description,
      searchText: normalizeSearchText(
        [
          example.title,
          example.description,
          example.packageName,
          example.operation,
          outcome.title,
          outcome.label,
          ...('diagnostics' in example.result
            ? example.result.diagnostics.map(({ code }) => code)
            : []),
        ].join(' '),
      ),
    });
  }

  return [...recordsByRoute.values()].sort(
    (left, right) => left.route.localeCompare(right.route) || left.title.localeCompare(right.title),
  );
};

/** Writes one link as an llms.txt list item, for the lists that sit outside a links section. */
const toLlmsLinkItem = ({ description, title, url }: ILlmsTextLink): string =>
  `- [${escapeMarkdownLabel(title)}](${url})${description === undefined ? '' : `: ${normalizeDescription(description)}`}`;

/** Creates the concise machine-oriented ecosystem map from generated public models. */
export const createLlmsText = (
  packages: IPublicPackage[],
  specification: IRepositoryFormatSpecification,
  gettingStarted: IPackageDocument,
): string => {
  const orderedPackages = [...packages].sort((left, right) => left.name.localeCompare(right.name));

  return buildLlmsText({
    name: 'moldea packages',
    summary:
      'Open-source CLI and TypeScript packages for project context, decision records, and structural checks in Git.',
    details: [
      'These tools read project knowledge, check declared files, and inspect explicit TypeScript and JavaScript ESM exports. Coverage states which checks ran. Runtime wiring, code semantics, and agent behavior are not checked.',
      [
        {
          title: gettingStarted.title,
          url: gettingStarted.route,
          description: gettingStarted.description,
        },
        {
          title: 'Capabilities',
          url: '/capabilities/',
          description:
            'Executable examples of project context, structure, decisions, declared binding checks, repository inspection, and CLI operations.',
        },
        {
          title: 'moldea Agent Skill',
          url: 'https://skill.moldea.ai/',
          description: 'Repository adoption, installation, workflows, and tutorials.',
        },
      ]
        .map(toLlmsLinkItem)
        .join('\n'),
    ],
    sections: [
      {
        heading: 'Packages',
        links: orderedPackages.map((packageModel) => ({
          title: packageModel.name,
          url: packageModel.route,
          description:
            packageModel.documents.find(({ slug }) => slug === '')?.description ??
            packageModel.description,
        })),
      },
      {
        heading: 'Package architecture',
        body: orderedPackages
          .map((packageModel) => {
            const dependencies = packageModel.dependencies.filter((name) =>
              orderedPackages.some((candidate) => candidate.name === name),
            );

            return dependencies.length > 0
              ? `- ${packageModel.name} -> ${dependencies.join(', ')}`
              : `- ${packageModel.name} -> foundational`;
          })
          .join('\n'),
      },
      {
        heading: 'Runtimes',
        body: [
          'Runtime IDs select agent guidance. Labels do not claim SDK compatibility, certification, or vendor endorsement.',
          'The coding agent reads the installed SDK type definitions and reviews how the application uses its declarations.',
          '',
          ...RUNTIME_CATALOG.map((runtime) =>
            toLlmsLinkItem({
              title: runtime.displayName,
              url: `/runtimes/#${runtime.id}`,
              description: runtime.id,
            }),
          ),
        ].join('\n'),
      },
      {
        heading: 'Canonical references',
        links: [
          {
            title: 'Repository Format specification',
            url: specification.route,
            description: `Official version ${specification.formatVersion} repository contract.`,
          },
          { title: 'Runtimes', url: '/runtimes/' },
          { title: 'Source repository', url: REPOSITORY_URL },
        ],
      },
    ],
  });
};

/**
 * Builds the complete deterministic website model without writing generated output.
 * Capability examples use disposable filesystem and Git workspaces that are removed before completion.
 * @returns A promise resolving to the validated content, real inspection example, and discovery model.
 * @throws
 * - If source content, discovery metadata, route ownership, or the real inspection example is invalid.
 */
export const createWebsiteModel = async (): Promise<IWebsiteModel> => {
  const repositoryRoot = getRepositoryRoot();
  const packages = discoverPublicPackages(repositoryRoot);
  const repositoryFormatSpecification = loadRepositoryFormatSpecification();
  const discoveryCopy = structuredClone(DISCOVERY_COPY);
  validateDiscoveryCopy(discoveryCopy, packages);
  const contentDirectory = join(repositoryRoot, 'apps/website/content');
  const gettingStarted = parseDocument(
    join(contentDirectory, 'getting-started.md'),
    contentDirectory,
    '/',
    repositoryRoot,
  );
  const inspectionExample = await createInspectionExample();
  const instructionExample = await createInstructionExample();
  const capabilities = await createCapabilities(repositoryRoot, packages);
  const routes = createRouteManifest(packages, gettingStarted);
  const searchRecords = createSearchRecords(
    packages,
    repositoryFormatSpecification,
    gettingStarted,
    discoveryCopy,
    capabilities,
  );

  return {
    capabilities,
    discoveryCopy,
    generatedNotice: GENERATED_NOTICE,
    gettingStarted,
    inspectionExample,
    instructionExample,
    llmsText: createLlmsText(packages, repositoryFormatSpecification, gettingStarted),
    packages,
    repositoryFormatSpecification,
    routes,
    searchRecords,
  };
};

/**
 * Writes the deterministic model consumed by Astro into the ignored application cache.
 * @param model Fully validated website model.
 * @returns A promise that resolves after the generated model is written.
 */
export const writeWebsiteModel = async (model: IWebsiteModel): Promise<void> => {
  const outputPath = join(getRepositoryRoot(), 'apps/website/.generated/model.json');

  await mkdir(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
};

/**
 * Reads the generated website model for static route generation.
 * @returns The previously generated deterministic website model.
 */
export const loadWebsiteModel = (): IWebsiteModel => {
  const path = join(getRepositoryRoot(), 'apps/website/.generated/model.json');

  if (!existsSync(path)) {
    throw new Error('Website model is missing. Run pnpm docs:generate first.');
  }

  return parseJsonFile(path) as IWebsiteModel;
};
