// @vitest-environment node
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  getContainedLogicalPath,
  getLexicalLinkCandidate,
  getLinkWalkStart,
  isRefusedLinkPath,
  stripLocalLongPathPrefix,
} from './utilities.js';

describe('isRefusedLinkPath', () => {
  test.each([
    ['//server/share/AGENTS.md', true],
    ['\\\\server\\share\\AGENTS.md', true],
    ['\\\\?\\UNC\\server\\share\\AGENTS.md', true],
    ['//?/UNC/server/share/AGENTS.md', true],
    ['\\\\.\\pipe\\name', true],
    ['\\\\.\\C:\\AGENTS.md', true],
    ['\\\\?\\GLOBALROOT\\Device\\Mup\\server', true],
    ['\\\\?\\Volume{01234567-89ab-cdef-0123-456789abcdef}\\AGENTS.md', true],
    ['C:AGENTS.md', true],
    ['c:', true],
    ['/net', true],
    ['/net/host/share', true],
    ['/NET/host/share', true],
    ['/Network/Servers/host', true],
    ['/network', true],
    ['\\net\\host', true],
    ['\\\\?\\C:\\shared\\AGENTS.md', false],
    ['//?/C:/shared/AGENTS.md', false],
    ['C:\\shared\\AGENTS.md', false],
    ['C:/shared/AGENTS.md', false],
    ['/home/user/shared/AGENTS.md', false],
    ['/networks/AGENTS.md', false],
    ['/net-docs/AGENTS.md', false],
    ['/srv/net/AGENTS.md', false],
    ['../../coding-instructions/src/AGENTS.md', false],
    ['AGENTS.md', false],
    ['docs/net/AGENTS.md', false],
  ])('isRefusedLinkPath(%s) -> %s', (candidate, expected) => {
    expect(isRefusedLinkPath(candidate)).toBe(expected);
  });
});

describe('getLexicalLinkCandidate', () => {
  test.each([
    ['../../../../../../../../net/host/share', '/net/host/share'],
    ['../../../../../../../../Network/Servers/host', '/Network/Servers/host'],
    ['../../../../../../../../../../../../../net/host', '/net/host'],
    ['../../coding-instructions/src/AGENTS.md', '/home/coding-instructions/src/AGENTS.md'],
  ])('getLexicalLinkCandidate(posix, %s) -> %s', (text, expected) => {
    const candidate = getLexicalLinkCandidate(path.posix, '/home/user/repository', text);

    expect(candidate).toBe(expected);
  });

  test('refuses deep relative chains that normalize to an automount root', () => {
    for (const text of [
      '../../../../../../../../net/host/share',
      '../../../../../../../../Network/Servers/host',
    ]) {
      expect(isRefusedLinkPath(text)).toBe(false);
      expect(
        isRefusedLinkPath(getLexicalLinkCandidate(path.posix, '/home/user/repository', text)),
      ).toBe(true);
    }
  });

  test('normalizes Windows text against the link directory', () => {
    expect(
      getLexicalLinkCandidate(path.win32, 'C:\\work\\repository', '..\\shared\\AGENTS.md'),
    ).toBe('C:\\work\\shared\\AGENTS.md');
    expect(
      isRefusedLinkPath(getLexicalLinkCandidate(path.win32, 'C:\\work', '\\\\server\\s')),
    ).toBe(true);
  });
});

describe('stripLocalLongPathPrefix', () => {
  test.each([
    ['\\\\?\\C:\\shared\\AGENTS.md', 'C:\\shared\\AGENTS.md'],
    ['//?/D:/shared/AGENTS.md', 'D:/shared/AGENTS.md'],
    ['\\\\?\\UNC\\server\\share', '\\\\?\\UNC\\server\\share'],
    ['../AGENTS.md', '../AGENTS.md'],
  ])('stripLocalLongPathPrefix(%s) -> %s', (text, expected) => {
    expect(stripLocalLongPathPrefix(text)).toBe(expected);
  });
});

describe('getLinkWalkStart', () => {
  test('keeps raw POSIX components so parent segments follow earlier links', () => {
    expect(
      getLinkWalkStart(path.posix, '/home/user/repository', 'shared/../docs/AGENTS.md'),
    ).toStrictEqual({
      components: ['shared', '..', 'docs', 'AGENTS.md'],
      directory: '/home/user/repository',
    });
    expect(getLinkWalkStart(path.posix, '/home/user/repository', '/etc/shared')).toStrictEqual({
      components: ['', 'etc', 'shared'],
      directory: '/',
    });
  });

  test('resolves Windows text lexically against the link directory', () => {
    expect(
      getLinkWalkStart(path.win32, 'C:\\work\\repository', 'shared\\..\\docs\\AGENTS.md'),
    ).toStrictEqual({ components: ['docs', 'AGENTS.md'], directory: 'C:\\work\\repository' });
    expect(
      getLinkWalkStart(path.win32, 'C:\\work\\repository', '..\\shared\\AGENTS.md'),
    ).toStrictEqual({ components: ['work', 'shared', 'AGENTS.md'], directory: 'C:\\' });
    expect(getLinkWalkStart(path.win32, 'C:\\work\\repository', 'D:\\shared')).toStrictEqual({
      components: ['shared'],
      directory: 'D:\\',
    });
    expect(getLinkWalkStart(path.win32, 'C:\\work\\repository', '.')).toStrictEqual({
      components: [],
      directory: 'C:\\work\\repository',
    });
  });
});

describe('getContainedLogicalPath', () => {
  test.each([
    ['/home/user/repository', '/'],
    ['/home/user/repository/docs/AGENTS.md', '/docs/AGENTS.md'],
    ['/home/user/repository-sibling/AGENTS.md', null],
    ['/home/user/AGENTS.md', null],
    ['/home/user/repository/..data/AGENTS.md', '/..data/AGENTS.md'],
  ])('getContainedLogicalPath(posix, %s) -> %s', (hostPath, expected) => {
    expect(getContainedLogicalPath(path.posix, '/home/user/repository', hostPath)).toBe(expected);
  });

  test.each([
    ['C:\\work\\repository\\docs\\AGENTS.md', '/docs/AGENTS.md'],
    ['c:\\WORK\\Repository\\AGENTS.md', '/AGENTS.md'],
    ['D:\\work\\repository\\AGENTS.md', null],
    ['C:\\work\\shared\\AGENTS.md', null],
  ])('getContainedLogicalPath(win32, %s) -> %s', (hostPath, expected) => {
    expect(getContainedLogicalPath(path.win32, 'C:\\work\\repository', hostPath)).toBe(expected);
  });
});
