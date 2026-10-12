// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { RECOGNIZED_RUNTIME_IDS } from '@moldea.ai/core';
import { describe, expect, test } from 'vitest';

import { RUNTIME_CATALOG, type IRuntimeCatalogEntry } from './index.js';

const logoDirectory = path.resolve(import.meta.dirname, '../../runtime-logos');
const logoNames = readdirSync(logoDirectory).sort();
const permittedElements = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'polygon',
  'polyline',
  'line',
  'defs',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
  'title',
  'desc',
]);
const permittedAttributes = new Set([
  'xmlns',
  'viewBox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'fill-rule',
  'fill-opacity',
  'clip-rule',
  'clip-path',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'opacity',
  'transform',
  'id',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'mask',
  'maskUnits',
  'maskContentUnits',
  'preserveAspectRatio',
  'color',
]);

describe('runtime catalog', () => {
  test('puts eve in the first three desktop rows, immediately before Mastra', () => {
    expect(RUNTIME_CATALOG.slice(0, 9).map(({ id }) => id)).toStrictEqual([
      'anthropic',
      'openai',
      'vercel-ai-sdk',
      'google-genai',
      'claude-agent-sdk',
      'langchain',
      'langgraph',
      'openai-agents-sdk',
      'eve',
    ]);
    expect(RUNTIME_CATALOG[9]?.id).toBe('mastra');
  });

  test('matches every Core runtime label exactly once, excluding custom', () => {
    expect(RUNTIME_CATALOG.map((runtime) => runtime.id).sort()).toStrictEqual(
      RECOGNIZED_RUNTIME_IDS.filter((id) => id !== 'custom').sort(),
    );
  });

  test('uses portable package-exported assets for every catalog entry', () => {
    const runtimes: IRuntimeCatalogEntry[] = [...RUNTIME_CATALOG];
    for (const runtime of runtimes) {
      for (const key of ['logoPath', 'darkLogoPath'] as const) {
        const assetPath = runtime[key];
        if (assetPath === undefined) continue;
        expect(assetPath).toMatch(
          /^@moldea\.ai\/website-ui\/runtime-logos\/[a-z0-9-]+\.(?:svg|png)$/u,
        );
        expect(logoNames).toContain(assetPath.split('/').at(-1));
      }
      const destination = new URL(runtime.websiteUrl);
      expect(destination.protocol).toBe('https:');
      expect(destination.hash).toBe('');
      expect(destination.username).toBe('');
      expect(destination.password).toBe('');
      expect(destination.hostname).not.toBe('packages.moldea.ai');
      expect(runtime.displayName.trim()).toBe(runtime.displayName);
      expect(runtime.displayName.length).toBeGreaterThan(0);
    }
  });

  test.each(logoNames.filter((name) => name.endsWith('.png')))(
    'keeps %s as a bounded static PNG',
    (name) => {
      const image = readFileSync(path.join(logoDirectory, name));
      expect([...image.subarray(0, 8)]).toStrictEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(image.readUInt32BE(16)).toBeGreaterThan(0);
      expect(image.readUInt32BE(20)).toBeGreaterThan(0);
      expect(image.byteLength).toBeLessThan(65536);
    },
  );

  test.each(logoNames.filter((name) => name.endsWith('.svg')))(
    'keeps %s self-contained and free of executable SVG constructs',
    (name) => {
      const svg = readFileSync(path.join(logoDirectory, name), 'utf8');
      expect(svg).toMatch(/^<svg\s[^>]*\bviewBox="[^"]+"[^>]*>/u);
      expect(svg).not.toMatch(/<!|<\?|&|\bon[a-z]+\s*=|\b(?:href|style|src)\s*=/iu);
      expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', '')).not.toMatch(
        /(?:https?:|data:|javascript:|\/\/)/iu,
      );
      for (const match of svg.matchAll(/<\/?([\w:-]+)/gu)) {
        expect(permittedElements.has(match[1] ?? ''), `${name}: ${match[1]}`).toBe(true);
      }
      for (const match of svg.matchAll(/\s([\w:-]+)\s*=\s*(?:"[^"]*"|'[^']*')/gu)) {
        expect(permittedAttributes.has(match[1] ?? ''), `${name}: ${match[1]}`).toBe(true);
      }
      for (const match of svg.matchAll(/url\(([^)]*)\)/giu)) {
        expect(match[1]).toMatch(/^#[a-zA-Z0-9_-]+$/u);
      }
    },
  );
});
