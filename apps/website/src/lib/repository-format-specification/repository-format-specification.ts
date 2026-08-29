import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import type {
  IRepositoryFormatCompleteExample,
  IRepositoryFormatExampleFile,
  IRepositoryFormatSpecification,
} from './types.ts';

const SPECIFICATION_PATH = 'specifications/repository-format.md';
const SPECIFICATION_ROUTE = '/repository-format/' as const;
const SPECIFICATION_SOURCE_URL =
  'https://github.com/moldea-ai/packages/blob/main/specifications/repository-format.md';
const REQUIRED_SECTIONS = [
  'Core principles',
  'Terminology',
  'Repository structure',
  'Git and local authoring state',
  'Text encoding and normalization',
  'Path rules',
  'Simple glob rules',
  'Stable IDs',
  'Manifest format',
  'Manifest version',
  'Project foundation',
  'Focused context',
  'Decision records',
  'Runtime guidance',
  'Agents',
  'Agent manifest shape',
  'Runtime declaration',
  'Agent context relationships',
  'Agent decision relationships',
  'Repository references and bindings',
  'Impact paths',
  'Tool and skill descriptions',
  'Tools',
  'Skills',
  'Runtime-native routing and handoffs',
  'Runtime variables',
  'Unresolved requirements',
  'Mirrors',
  'Project-local runtime deviations',
  'Convention-based discovery versus manifest declaration',
  'Strict validation',
  'Semantic evaluation',
  'Diagnostic principles',
  'Security and secret handling',
  'Complete example',
  'Conformance and future evolution',
] as const;

const SpecificationFrontmatterSchema = z.strictObject({
  description: z.string().min(1),
  formatVersion: z.literal(1),
  title: z.string().min(1),
});

const getRepositoryRoot = (): string => {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
};

/** Creates the stable heading IDs emitted by the shared Markdown pipeline. */
const createHeadingIds = (markdown: string): ReadonlySet<string> => {
  const occurrences = new Map<string, number>();
  const ids = new Set<string>();

  for (const match of markdown.matchAll(/^#{1,6}\s+(.+)$/gmu)) {
    const heading = match[1] ?? '';
    const baseId = heading
      .replaceAll(/`([^`]*)`/g, '$1')
      .toLocaleLowerCase('en-US')
      .replaceAll(/[^\p{L}\p{N}\s_-]/gu, '')
      .trim()
      .replaceAll(/\s+/g, '-');
    const occurrence = occurrences.get(baseId) ?? 0;
    const id = occurrence === 0 ? baseId : `${baseId}-${occurrence}`;

    occurrences.set(baseId, occurrence + 1);
    ids.add(id);
  }

  return ids;
};

/** Rejects source-local links whose target heading does not exist. */
const validateInternalAnchors = (markdown: string): void => {
  const headingIds = createHeadingIds(markdown);

  for (const match of markdown.matchAll(/\[[^\]]*\]\(#([^)\s]+)\)/gu)) {
    const encodedId = match[1] ?? '';
    let id: string;

    try {
      id = decodeURIComponent(encodedId);
    } catch (error) {
      throw new Error(`Repository Format specification has an invalid anchor #${encodedId}.`, {
        cause: error,
      });
    }

    if (!headingIds.has(id)) {
      throw new Error(`Repository Format specification links to missing anchor #${id}.`);
    }
  }
};

/** Extracts and validates the property paths from the authoritative reference table. */
const extractPropertyPaths = (markdown: string): string[] => {
  const section = /### Manifest property reference\n([\s\S]*?)(?=\n## )/u.exec(markdown)?.[1];

  if (section === undefined) {
    throw new Error('Repository Format specification is missing its manifest property reference.');
  }

  const propertyPaths = [...section.matchAll(/^\|\s+`([^`]+)`\s+\|/gmu)].map(
    (match) => match[1] ?? '',
  );
  const uniquePaths = new Set(propertyPaths);

  if (propertyPaths.length === 0) {
    throw new Error('Repository Format specification has an empty manifest property reference.');
  }
  if (uniquePaths.size !== propertyPaths.length) {
    throw new Error('Repository Format specification has duplicate manifest property paths.');
  }
  if (
    propertyPaths.some(
      (propertyPath) =>
        !/^[a-z][A-Za-z]*(?:(?:\.(?:[a-z][A-Za-z]*|\{[a-z]+(?:-[a-z]+)*\}))|\[\])*$/u.test(
          propertyPath,
        ),
    )
  ) {
    throw new Error('Repository Format specification has an invalid manifest property path.');
  }

  return propertyPaths;
};

/** Assembles complete repository examples from deliberately marked fenced files. */
const extractCompleteExamples = (markdown: string): IRepositoryFormatCompleteExample[] => {
  const filesByExample = new Map<string, IRepositoryFormatExampleFile[]>();
  const examplePattern =
    /<!-- repository-example:([a-z0-9]+(?:-[a-z0-9]+)*):(\/[^\s]+) -->\n\n```([a-z0-9-]+)\n([\s\S]*?)\n```/gu;

  for (const match of markdown.matchAll(examplePattern)) {
    const id = match[1] ?? '';
    const path = match[2] ?? '';
    const language = match[3] ?? '';
    const content = match[4] ?? '';
    const files = filesByExample.get(id) ?? [];

    if (files.some((file) => file.path === path)) {
      throw new Error(`Repository Format example ${id} declares ${path} more than once.`);
    }

    files.push({ content, language, path });
    filesByExample.set(id, files);
  }

  if (filesByExample.size === 0) {
    throw new Error('Repository Format specification has no marked complete repository example.');
  }

  return [...filesByExample.entries()]
    .map(([id, files]) => ({
      files: [...files].sort((left, right) => left.path.localeCompare(right.path)),
      id,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
};

/** Validates that every required contract area remains present exactly once. */
const validateRequiredSections = (markdown: string): void => {
  const secondLevelHeadings = [...markdown.matchAll(/^##\s+(.+)$/gmu)].map(
    (match) => match[1] ?? '',
  );

  for (const section of REQUIRED_SECTIONS) {
    if (secondLevelHeadings.filter((heading) => heading === section).length !== 1) {
      throw new Error(
        `Repository Format specification must contain exactly one ${section} section.`,
      );
    }
  }
};

/**
 * Parses and validates the authoritative Repository Format source.
 * @param source Complete frontmatter and Markdown source.
 * @returns The deterministic specification model consumed by generated website surfaces.
 * @throws If metadata, required sections, property paths, examples, or internal anchors are invalid.
 */
export const parseRepositoryFormatSpecification = (
  source: string,
): IRepositoryFormatSpecification => {
  const normalizedSource = source.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(normalizedSource);

  if (match === null) {
    throw new Error('Repository Format specification must start with YAML frontmatter.');
  }

  const metadata = SpecificationFrontmatterSchema.parse(parseYaml(match[1]));
  const markdown = (match[2] ?? '').trim();

  if (!markdown.startsWith('# Repository format specification\n')) {
    throw new Error('Repository Format specification must start with its canonical title.');
  }

  validateRequiredSections(markdown);
  validateInternalAnchors(markdown);

  return {
    completeExamples: extractCompleteExamples(markdown),
    description: metadata.description,
    formatVersion: metadata.formatVersion,
    markdown,
    propertyPaths: extractPropertyPaths(markdown),
    route: SPECIFICATION_ROUTE,
    sourcePath: SPECIFICATION_PATH,
    sourceUrl: SPECIFICATION_SOURCE_URL,
    title: metadata.title,
  };
};

/**
 * Loads the sole repository-owned public Repository Format specification.
 * @returns The validated source model without a generated prose copy.
 * @throws If the authoritative source cannot be read or validated.
 */
export const loadRepositoryFormatSpecification = (): IRepositoryFormatSpecification => {
  return parseRepositoryFormatSpecification(
    readFileSync(resolve(getRepositoryRoot(), SPECIFICATION_PATH), 'utf8'),
  );
};
