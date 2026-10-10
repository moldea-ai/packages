import { parse, type DefaultTreeAdapterMap } from 'parse5';

import {
  getCapabilityShowcase,
  getCapabilityVisualFamily,
  getCapabilityOutcome,
  getCapabilityResultExcerpt,
  type ICapabilities,
} from '../../src/lib/capabilities/index.ts';

/** Reads a parsed subtree, retaining exact code whitespace when the separator is empty. */
const readText = (node: DefaultTreeAdapterMap['node'], separator = ' '): string => {
  if ('value' in node) return node.value;
  return 'childNodes' in node
    ? node.childNodes.map((child) => readText(child, separator)).join(separator)
    : '';
};

/** Collects standard JSON excerpts even though result dialogs are initially closed. */
const readResultExcerpts = (dialog: DefaultTreeAdapterMap['node']): string[] => {
  const excerpts: string[] = [];
  const pending = [dialog];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    if (
      'tagName' in node &&
      node.tagName === 'code' &&
      node.attrs.some(
        ({ name, value }) => name === 'class' && value.split(/\s+/u).includes('language-json'),
      )
    )
      excerpts.push(readText(node, ''));
    else if ('childNodes' in node) pending.push(...node.childNodes);
  }
  return excerpts;
};

/**
 * Requires compact outcomes, complete illustrations, and discovery from the static fallback.
 * @throws If a required illustration, result, section, or discovery entry is missing or stale.
 */
export const verifyCapabilityArtifacts = (
  html: string,
  homepage: string,
  llmsText: string,
  searchDocuments: { url: string; title: string }[],
  catalog: ICapabilities,
  pageUrl: URL,
): void => {
  const visibleIds = new Set<string>();
  const outcomes = new Set<string>();
  const labels = new Map<string, string>();
  const summaries = new Map<string, string>();
  const visuals = new Map<string, string>();
  const references = new Set<string>();
  const resultExcerpts = new Map<string, string[]>();
  const showcase = getCapabilityShowcase(catalog);
  const pending: DefaultTreeAdapterMap['node'][] = [parse(html)];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    if ('tagName' in node) {
      const attributes = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
      if (node.tagName === 'dialog' && attributes.id?.startsWith('result-'))
        resultExcerpts.set(attributes.id, readResultExcerpts(node));
      if (
        ['script', 'template'].includes(node.tagName) ||
        (node.tagName === 'dialog' &&
          !node.attrs.some(({ name }) => name === 'data-dialog-fallback-open')) ||
        node.attrs.some(({ name }) => name === 'hidden')
      )
        continue;
      if (attributes.id) visibleIds.add(attributes.id);
      if (attributes['data-capability-outcome']) {
        outcomes.add(attributes['data-capability-outcome']);
        labels.set(
          attributes['data-capability-outcome'],
          attributes['data-capability-label'] ?? '',
        );
      }
      if (attributes['data-capability-summary'])
        summaries.set(
          attributes['data-capability-summary'],
          readText(node).replaceAll(/\s+/gu, ' ').trim(),
        );
      if (attributes['data-capability-visual']) {
        let parent: DefaultTreeAdapterMap['node'] | null = node.parentNode;
        while (parent && 'tagName' in parent) {
          const id = parent.attrs.find(({ name }) => name === 'id')?.value;
          if (parent.attrs.some(({ name }) => name === 'data-capability-example') && id) {
            if (visuals.has(id))
              throw new Error(`Capabilities artifact duplicates illustration ${id}.`);
            visuals.set(id, attributes['data-capability-visual']);
            break;
          }
          parent = parent.parentNode;
        }
      }
      if (node.tagName === 'a' && attributes.href) references.add(attributes.href);
      if (node.tagName === 'details' && !Object.hasOwn(attributes, 'open')) {
        pending.push(
          ...node.childNodes.filter((child) => 'tagName' in child && child.tagName === 'summary'),
        );
        continue;
      }
    }
    if ('childNodes' in node) pending.push(...node.childNodes);
  }

  for (const group of catalog.groups) {
    if (!visibleIds.has(group.id))
      throw new Error(`Capabilities artifact omits visible section ${group.id}.`);
  }
  for (const { examples, group } of showcase) {
    for (const example of examples) {
      if (!visibleIds.has(example.id) || !outcomes.has(example.id))
        throw new Error(`Capabilities artifact omits visible result ${example.id}.`);
      if (!html.includes(`id="example-${example.id}"`))
        throw new Error(`Capabilities artifact omits illustration dialog ${example.id}.`);
      if (visuals.get(example.id) !== getCapabilityVisualFamily(example))
        throw new Error(`Capabilities artifact has the wrong visual family for ${example.id}.`);
      const outcome = getCapabilityOutcome(example, catalog);
      if (
        labels.get(example.id) !== outcome.label ||
        summaries.get(example.id) !== `${outcome.title} ${outcome.label}`
      )
        throw new Error(`Capabilities artifact has an unsupported outcome for ${example.id}.`);
      if (!html.includes(`id="result-${example.id}"`))
        throw new Error(`Capabilities artifact omits result dialog ${example.id}.`);
      const excerpts = resultExcerpts.get(`result-${example.id}`);
      if (excerpts?.length !== 1)
        throw new Error(`Capabilities artifact omits standard JSON presentation ${example.id}.`);
      if (excerpts[0] !== JSON.stringify(getCapabilityResultExcerpt(example.result), null, 2))
        throw new Error(`Capabilities artifact result does not match execution ${example.id}.`);
    }
    const referencePath = new URL(`..${group.reference.route}`, pageUrl).pathname;
    if (!references.has(referencePath))
      throw new Error(`Capabilities artifact omits reference link ${referencePath}.`);
  }
  const examples = showcase.flatMap((section) => section.examples);
  if (outcomes.size !== examples.length)
    throw new Error('Capabilities artifact contains an unknown example.');
  const expectedRecords = new Map([
    [pageUrl.pathname, 'Capabilities'],
    ...catalog.groups.map(({ id, title }): [string, string] => [
      `${pageUrl.pathname}#${id}`,
      title,
    ]),
    ...examples.map((example): [string, string] => [
      `${pageUrl.pathname}#${example.id}`,
      example.title,
    ]),
  ]);
  for (const [url, title] of expectedRecords) {
    const records = searchDocuments.filter((record) => record.url === url);
    if (records.length !== 1 || records[0].title !== title)
      throw new Error(`Capabilities search discovery is missing or duplicated: ${url}.`);
  }
  if (
    searchDocuments.some(
      ({ url }) => url.startsWith(`${pageUrl.pathname}#`) && !expectedRecords.has(url),
    )
  )
    throw new Error('Capabilities search discovery contains an unknown example.');
  if (!llmsText.includes(`[Capabilities](${pageUrl.href})`))
    throw new Error('Capabilities machine discovery is missing.');
  if (homepage.split(`href="${pageUrl.pathname}"`).length - 1 !== 4)
    throw new Error('Capabilities homepage, header, or footer discovery is missing.');
};
