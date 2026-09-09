import { parse, type DefaultTreeAdapterMap } from 'parse5';

import { FEATURED_CAPABILITY_CASES, type ICapabilities } from '../../src/lib/capabilities/index.ts';

/**
 * Requires visible capability outcomes and complete discovery, independently of dialog content.
 * @throws If a required example, target, result, section, or discovery entry is missing.
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
  const targets = new Map<string, Set<string>>();
  const pending: { node: DefaultTreeAdapterMap['node']; target?: string }[] = [
    { node: parse(html) },
  ];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    const { node } = current;
    let target = current.target;
    if ('tagName' in node) {
      if (
        ['dialog', 'script', 'template'].includes(node.tagName) ||
        node.attrs.some(({ name }) => name === 'hidden')
      )
        continue;
      const attributes = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
      if (attributes.id) visibleIds.add(attributes.id);
      if (attributes['data-capability-outcome'])
        outcomes.add(attributes['data-capability-outcome']);
      if (attributes['data-capability-target']) {
        target = attributes['data-capability-target'];
        targets.set(target, new Set());
      }
      if (target && attributes['data-capability-pattern'])
        targets.get(target)?.add(attributes['data-capability-pattern']);
    }
    if ('childNodes' in node)
      pending.push(...node.childNodes.map((child) => ({ node: child, target })));
  }

  for (const group of catalog.groups) {
    if (!visibleIds.has(group.id))
      throw new Error(`Capabilities artifact omits visible section ${group.id}.`);
  }
  for (const example of catalog.cases) {
    if (!visibleIds.has(example.id) || !outcomes.has(example.id))
      throw new Error(`Capabilities artifact omits visible result ${example.id}.`);
  }
  for (const { adapterId, target, patterns } of catalog.runtimeTargets) {
    const key = `${adapterId}/${target.id}`;
    const visiblePatterns = targets.get(key);
    if (!visiblePatterns || patterns.some(({ id }) => !visiblePatterns.has(id)))
      throw new Error(`Capabilities artifact omits target or source forms for ${key}.`);
  }
  for (const id of Object.values(FEATURED_CAPABILITY_CASES).flat()) {
    if (!html.includes(`id="result-${id}"`))
      throw new Error(`Capabilities artifact omits result dialog ${id}.`);
  }
  const expectedRecords = new Map([
    [pageUrl.pathname, 'Capabilities'],
    ...catalog.groups.map(({ id, title }): [string, string] => [
      `${pageUrl.pathname}#${id}`,
      title,
    ]),
    ...catalog.cases.map(({ id, title }): [string, string] => [`${pageUrl.pathname}#${id}`, title]),
  ]);
  for (const [url, title] of expectedRecords) {
    const records = searchDocuments.filter((record) => record.url === url);
    if (records.length !== 1 || records[0].title !== title)
      throw new Error(`Capabilities search discovery is missing or duplicated: ${url}.`);
  }
  if (!llmsText.includes(`[Capabilities](${pageUrl.href})`))
    throw new Error('Capabilities machine discovery is missing.');
  if (homepage.split(`href="${pageUrl.pathname}"`).length - 1 !== 4)
    throw new Error('Capabilities homepage, header, or footer discovery is missing.');
};
