import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { z } from 'zod';

import type { IHtmlSeoArtifact, ISeoArtifacts } from './types.ts';

type IHtmlElement = DefaultTreeAdapterMap['element'];
type IHtmlNode = DefaultTreeAdapterMap['node'];

const BreadcrumbListSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('BreadcrumbList'),
  itemListElement: z
    .array(
      z.object({
        '@type': z.literal('ListItem'),
        position: z.number().int().positive(),
        name: z.string().min(1),
        item: z.url().optional(),
      }),
    )
    .min(2),
});

const WebsiteSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('WebSite'),
  name: z.string().min(1),
  alternateName: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
  url: z.url(),
});

const StructuredDataSchema = z.union([BreadcrumbListSchema, WebsiteSchema]);

/** Returns whether a parsed HTML node is an element. */
const isHtmlElement = (node: IHtmlNode): node is IHtmlElement => 'tagName' in node;

/** Collects parsed elements in one linear traversal. */
const collectHtmlElements = (root: IHtmlNode): IHtmlElement[] => {
  const elements: IHtmlElement[] = [];
  const pendingNodes: IHtmlNode[] = [root];

  while (pendingNodes.length > 0) {
    const node = pendingNodes.pop();

    if (node === undefined) continue;
    if (isHtmlElement(node)) elements.push(node);
    if ('childNodes' in node) pendingNodes.push(...node.childNodes);
  }

  return elements;
};

/** Returns one element attribute when present. */
const getAttribute = (element: IHtmlElement, name: string): string | undefined => {
  return element.attrs.find((attribute) => attribute.name === name)?.value;
};

/** Extracts the text content beneath a parsed HTML node. */
const getTextContent = (node: IHtmlNode): string => {
  if ('value' in node) return node.value;
  if (!('childNodes' in node)) return '';

  return node.childNodes.map((childNode) => getTextContent(childNode)).join('');
};

/** Returns metadata values selected by their name or property attribute. */
const getMetadataValues = (
  elements: IHtmlElement[],
  qualifier: 'name' | 'property',
  key: string,
): string[] => {
  return elements
    .filter((element) => element.tagName === 'meta' && getAttribute(element, qualifier) === key)
    .map((element) => getAttribute(element, 'content') ?? '');
};

/** Returns link destinations that declare the requested relationship. */
const getLinkValues = (elements: IHtmlElement[], relationship: string): string[] => {
  return elements
    .filter(
      (element) =>
        element.tagName === 'link' &&
        (getAttribute(element, 'rel')?.split(/\s+/u).includes(relationship) ?? false),
    )
    .map((element) => getAttribute(element, 'href') ?? '');
};

/** Requires one non-empty value for a page-level metadata contract. */
const requireSingleValue = (values: string[], label: string, pageUrl: string): string => {
  if (values.length !== 1 || values[0].trim().length === 0) {
    throw new Error(`${pageUrl} must contain exactly one non-empty ${label}.`);
  }

  return values[0];
};

/** Requires one metadata value to equal its authoritative page value. */
const requireMatchingValue = (
  values: string[],
  expectedValue: string,
  label: string,
  pageUrl: string,
): void => {
  const value = requireSingleValue(values, label, pageUrl);

  if (value !== expectedValue) {
    throw new Error(`${pageUrl} has ${label} that does not match its authoritative metadata.`);
  }
};

/** Decodes the XML entities that may occur inside sitemap locations. */
const decodeXmlText = (source: string): string => {
  return source
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
};

/** Parses unique absolute locations from the generated sitemap documents. */
const parseSitemapUrls = (sitemapSources: string[]): Set<string> => {
  if (sitemapSources.length === 0) throw new Error('The SEO audit requires a generated sitemap.');

  const sitemapUrls = new Set<string>();

  for (const source of sitemapSources) {
    for (const match of source.matchAll(/<loc>([^<]+)<\/loc>/gu)) {
      const sitemapUrl = new URL(decodeXmlText(match[1])).href;

      if (sitemapUrls.has(sitemapUrl)) {
        throw new Error(`The generated sitemap contains duplicate URL ${sitemapUrl}.`);
      }

      sitemapUrls.add(sitemapUrl);
    }
  }

  return sitemapUrls;
};

/** Parses and validates supported Schema.org JSON-LD blocks. */
const parseStructuredData = (elements: IHtmlElement[]) => {
  return elements
    .filter(
      (element) =>
        element.tagName === 'script' && getAttribute(element, 'type') === 'application/ld+json',
    )
    .map((element) => StructuredDataSchema.parse(JSON.parse(getTextContent(element))));
};

/** Verifies the WebSite or breadcrumb structured data required for one page. */
const verifyStructuredData = (
  artifact: IHtmlSeoArtifact,
  structuredData: z.infer<typeof StructuredDataSchema>[],
  homePageUrl: string,
  siteName: string,
  websiteStructuredDataUrl: string | null,
): void => {
  if (artifact.url === homePageUrl) {
    if (websiteStructuredDataUrl === null) {
      if (structuredData.some((record) => record['@type'] === 'WebSite')) {
        throw new Error('WebSite structured data cannot represent a subdirectory deployment.');
      }
      return;
    }

    const websiteRecords = structuredData.filter((record) => record['@type'] === 'WebSite');

    if (websiteRecords.length !== 1) {
      throw new Error(`${artifact.url} must contain exactly one WebSite structured-data record.`);
    }

    const websiteRecord = WebsiteSchema.parse(websiteRecords[0]);

    if (websiteRecord.name !== siteName || websiteRecord.url !== websiteStructuredDataUrl) {
      throw new Error(`${artifact.url} has inconsistent WebSite structured data.`);
    }
    return;
  }

  const breadcrumbRecords = structuredData.filter((record) => record['@type'] === 'BreadcrumbList');

  if (breadcrumbRecords.length !== 1) {
    throw new Error(`${artifact.url} must contain exactly one BreadcrumbList record.`);
  }

  const breadcrumbRecord = BreadcrumbListSchema.parse(breadcrumbRecords[0]);

  for (const [index, item] of breadcrumbRecord.itemListElement.entries()) {
    if (item.position !== index + 1) {
      throw new Error(`${artifact.url} contains non-sequential breadcrumb positions.`);
    }
    if (index < breadcrumbRecord.itemListElement.length - 1 && item.item === undefined) {
      throw new Error(`${artifact.url} contains a breadcrumb ancestor without an absolute URL.`);
    }
  }

  if (breadcrumbRecord.itemListElement[0].item !== homePageUrl) {
    throw new Error(`${artifact.url} does not begin its breadcrumb trail at the canonical home.`);
  }
};

/** Verifies complete Open Graph and Twitter metadata for one indexable page. */
const verifySocialMetadata = (
  elements: IHtmlElement[],
  pageUrl: string,
  title: string,
  description: string,
  siteName: string,
): void => {
  requireMatchingValue(
    getMetadataValues(elements, 'property', 'og:type'),
    'website',
    'og:type',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'property', 'og:site_name'),
    siteName,
    'og:site_name',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'property', 'og:title'),
    title,
    'og:title',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'property', 'og:description'),
    description,
    'og:description',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'property', 'og:url'),
    pageUrl,
    'og:url',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'property', 'og:locale'),
    'en_US',
    'og:locale',
    pageUrl,
  );

  const openGraphImage = requireSingleValue(
    getMetadataValues(elements, 'property', 'og:image'),
    'og:image',
    pageUrl,
  );

  if (new URL(openGraphImage).protocol !== 'https:') {
    throw new Error(`${pageUrl} must publish an HTTPS Open Graph image.`);
  }

  requireMatchingValue(
    getMetadataValues(elements, 'property', 'og:image:secure_url'),
    openGraphImage,
    'og:image:secure_url',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'property', 'og:image:type'),
    'image/png',
    'og:image:type',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'property', 'og:image:width'),
    '1730',
    'og:image:width',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'property', 'og:image:height'),
    '909',
    'og:image:height',
    pageUrl,
  );
  requireSingleValue(
    getMetadataValues(elements, 'property', 'og:image:alt'),
    'og:image:alt',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'name', 'twitter:card'),
    'summary_large_image',
    'twitter:card',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'name', 'twitter:title'),
    title,
    'twitter:title',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'name', 'twitter:description'),
    description,
    'twitter:description',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'name', 'twitter:image'),
    openGraphImage,
    'twitter:image',
    pageUrl,
  );
  requireMatchingValue(
    getMetadataValues(elements, 'name', 'twitter:image:alt'),
    requireSingleValue(
      getMetadataValues(elements, 'property', 'og:image:alt'),
      'og:image:alt',
      pageUrl,
    ),
    'twitter:image:alt',
    pageUrl,
  );
};

/**
 * Verifies indexability, unique metadata, canonical URLs, social cards, structured data, and sitemap alignment.
 * @param artifacts The generated HTML and sitemap sources with their canonical deployment context.
 */
export const verifySeoArtifacts = (artifacts: ISeoArtifacts): void => {
  const sitemapUrls = parseSitemapUrls(artifacts.sitemapSources);
  const canonicalUrls = new Set<string>();
  const titleOwners = new Map<string, string>();
  const descriptionOwners = new Map<string, string>();

  for (const artifact of artifacts.htmlArtifacts) {
    const elements = collectHtmlElements(parse(artifact.source));
    const title = requireSingleValue(
      elements.filter((element) => element.tagName === 'title').map(getTextContent),
      'title',
      artifact.url,
    );
    const description = requireSingleValue(
      getMetadataValues(elements, 'name', 'description'),
      'meta description',
      artifact.url,
    );
    const headingCount = elements.filter((element) => element.tagName === 'h1').length;

    if (headingCount !== 1) throw new Error(`${artifact.url} must contain exactly one h1.`);

    const robotsValues = getMetadataValues(elements, 'name', 'robots');

    if (robotsValues.length > 1) {
      throw new Error(`${artifact.url} contains conflicting robots metadata.`);
    }

    const isNoIndex =
      robotsValues[0]
        ?.toLowerCase()
        .split(',')
        .map((directive) => directive.trim())
        .includes('noindex') ?? false;
    const canonicalValues = getLinkValues(elements, 'canonical');

    if (isNoIndex) {
      if (canonicalValues.length > 0) {
        throw new Error(
          `${artifact.url} must not declare a canonical URL while noindex is active.`,
        );
      }
      if (sitemapUrls.has(artifact.url)) {
        throw new Error(`${artifact.url} is noindex but remains in the generated sitemap.`);
      }
      continue;
    }

    const canonicalUrl = requireSingleValue(canonicalValues, 'canonical URL', artifact.url);

    if (new URL(canonicalUrl).href !== artifact.url) {
      throw new Error(`${artifact.url} does not declare itself as its canonical URL.`);
    }
    if (!sitemapUrls.has(artifact.url)) {
      throw new Error(`${artifact.url} is indexable but absent from the generated sitemap.`);
    }

    const existingTitleOwner = titleOwners.get(title);

    if (existingTitleOwner !== undefined) {
      throw new Error(`${artifact.url} and ${existingTitleOwner} share title "${title}".`);
    }

    const existingDescriptionOwner = descriptionOwners.get(description);

    if (existingDescriptionOwner !== undefined) {
      throw new Error(
        `${artifact.url} and ${existingDescriptionOwner} share meta description "${description}".`,
      );
    }

    titleOwners.set(title, artifact.url);
    descriptionOwners.set(description, artifact.url);
    canonicalUrls.add(artifact.url);
    verifySocialMetadata(elements, artifact.url, title, description, artifacts.siteName);
    verifyStructuredData(
      artifact,
      parseStructuredData(elements),
      artifacts.homePageUrl,
      artifacts.siteName,
      artifacts.websiteStructuredDataUrl,
    );
  }

  if (canonicalUrls.size !== sitemapUrls.size) {
    throw new Error('The generated sitemap does not match the complete canonical page set.');
  }

  for (const sitemapUrl of sitemapUrls) {
    if (!canonicalUrls.has(sitemapUrl)) {
      throw new Error(`The generated sitemap contains non-canonical URL ${sitemapUrl}.`);
    }
  }
};
