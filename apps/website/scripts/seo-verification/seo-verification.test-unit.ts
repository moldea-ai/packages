// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { verifySeoArtifacts } from './index.ts';
import type { IHtmlSeoArtifact } from './types.ts';

const HOME_URL = 'https://packages.moldea.ai/';
const IMAGE_URL = 'https://packages.moldea.ai/open-graph/ogimage.png';
const SITE_NAME = 'moldea packages';

interface IIndexableHtmlOptions {
  description: string;
  structuredData: object;
  title: string;
  url: string;
}

/** Creates a complete indexable HTML fixture for the SEO contract. */
const createIndexableHtml = ({
  description,
  structuredData,
  title,
  url,
}: IIndexableHtmlOptions): IHtmlSeoArtifact => ({
  source: `<!doctype html><html lang="en"><head>
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${url}">
    <meta property="og:locale" content="en_US">
    <meta property="og:image" content="${IMAGE_URL}">
    <meta property="og:image:secure_url" content="${IMAGE_URL}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1730">
    <meta property="og:image:height" content="909">
    <meta property="og:image:alt" content="moldea packages preview">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${IMAGE_URL}">
    <meta name="twitter:image:alt" content="moldea packages preview">
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
  </head><body><h1>${title}</h1></body></html>`,
  url,
});

/** Creates a noindex HTML fixture without canonical or social metadata. */
const createNoIndexHtml = (url: string): IHtmlSeoArtifact => ({
  source: `<!doctype html><html lang="en"><head>
    <title>Not found · moldea packages</title>
    <meta name="description" content="The requested page was not found.">
    <meta name="robots" content="noindex, follow">
  </head><body><h1>Not found</h1></body></html>`,
  url,
});

const createBreadcrumbs = (name: string) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
    { '@type': 'ListItem', position: 2, name },
  ],
});

const createWebsite = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: 'packages.moldea.ai',
  url: HOME_URL,
});

const createSitemap = (urls: string[]): string => {
  return `<urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>`;
};

describe('verifySeoArtifacts', () => {
  test('accepts unique canonical pages and excludes noindex artifacts from the sitemap', () => {
    const documentationUrl = `${HOME_URL}packages/core/`;

    expect(() =>
      verifySeoArtifacts({
        homePageUrl: HOME_URL,
        htmlArtifacts: [
          createIndexableHtml({
            description: 'Open-source behavioral integrity packages.',
            structuredData: createWebsite(),
            title: 'Behavioral integrity · moldea packages',
            url: HOME_URL,
          }),
          createIndexableHtml({
            description: 'The deterministic Core package.',
            structuredData: createBreadcrumbs('Core'),
            title: '@moldea.ai/core · moldea packages',
            url: documentationUrl,
          }),
          createNoIndexHtml(`${HOME_URL}404.html`),
        ],
        sitemapSources: [createSitemap([HOME_URL, documentationUrl])],
        siteName: SITE_NAME,
        websiteStructuredDataUrl: HOME_URL,
      }),
    ).not.toThrow();
  });

  test('rejects duplicate titles across canonical pages', () => {
    const firstUrl = `${HOME_URL}adapters/openai/limitations/`;
    const secondUrl = `${HOME_URL}adapters/anthropic/limitations/`;

    expect(() =>
      verifySeoArtifacts({
        homePageUrl: HOME_URL,
        htmlArtifacts: [
          createIndexableHtml({
            description: 'OpenAI adapter limitations.',
            structuredData: createBreadcrumbs('OpenAI limitations'),
            title: 'Limitations · moldea packages',
            url: firstUrl,
          }),
          createIndexableHtml({
            description: 'Anthropic adapter limitations.',
            structuredData: createBreadcrumbs('Anthropic limitations'),
            title: 'Limitations · moldea packages',
            url: secondUrl,
          }),
        ],
        sitemapSources: [createSitemap([firstUrl, secondUrl])],
        siteName: SITE_NAME,
        websiteStructuredDataUrl: HOME_URL,
      }),
    ).toThrow('share title "Limitations · moldea packages"');
  });

  test('rejects a noindex page included in the sitemap', () => {
    const missingUrl = `${HOME_URL}404.html`;

    expect(() =>
      verifySeoArtifacts({
        homePageUrl: HOME_URL,
        htmlArtifacts: [createNoIndexHtml(missingUrl)],
        sitemapSources: [createSitemap([missingUrl])],
        siteName: SITE_NAME,
        websiteStructuredDataUrl: HOME_URL,
      }),
    ).toThrow('is noindex but remains in the generated sitemap');
  });
});
