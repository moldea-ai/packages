// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import { createInspectionSessionFactory } from './session.js';

describe('createInspectionSessionFactory', () => {
  test('shares resident work across sessions only within one owner and factory', async () => {
    const analyzeSource = vi.fn((path: string, bytes: Uint8Array) => ({ bytes, path }));
    const discoverPackage = vi.fn((path: string) => Promise.resolve({ path }));
    const getEntry = vi.fn((path: string) => Promise.resolve({ path, type: 'file' }));
    const readFile = vi.fn(() => Promise.resolve(new Uint8Array([1, 2])));
    const options = (owner: object) => ({
      owner,
      analyzeSource,
      discoverPackage,
      getEntry,
      readFile,
      getSourceRetainedBytes: () => 65536,
    });
    const createSession = createInspectionSessionFactory(options);
    const owner = {};
    const first = createSession(owner);
    const second = createSession(owner);
    await expect(
      Promise.all([first.analyzeSource('/a.ts'), second.analyzeSource('/a.ts')]),
    ).resolves.toStrictEqual([
      { bytes: new Uint8Array([1, 2]), path: '/a.ts' },
      { bytes: new Uint8Array([1, 2]), path: '/a.ts' },
    ]);
    await Promise.all([first.discoverPackage('/a.ts'), second.discoverPackage('/a.ts')]);
    await Promise.all([first.getEntry('/a.ts'), second.getEntry('/a.ts')]);
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(analyzeSource).toHaveBeenCalledTimes(1);
    expect(discoverPackage).toHaveBeenCalledTimes(1);
    expect(getEntry).toHaveBeenCalledTimes(1);
    await createSession({}).analyzeSource('/a.ts');
    await createInspectionSessionFactory(options)(owner).analyzeSource('/a.ts');
    expect(analyzeSource).toHaveBeenCalledTimes(3);
  });

  test('checks cancellation on resident hits', async () => {
    const controller = new AbortController();
    const session = createInspectionSessionFactory((owner: object) => ({
      owner,
      analyzeSource: (path: string) => path,
      discoverPackage: () => Promise.resolve('package'),
      getEntry: () => Promise.resolve('entry'),
      readFile: () => Promise.resolve(new Uint8Array()),
      signal: controller.signal,
      getSourceRetainedBytes: () => 65536,
    }))({});
    await session.analyzeSource('/a.ts');
    await session.discoverPackage('/a.ts');
    await session.getEntry('/a.ts');
    controller.abort();
    await expect(session.analyzeSource('/a.ts')).rejects.toThrow();
    await expect(session.discoverPackage('/a.ts')).rejects.toThrow();
    await expect(session.getEntry('/a.ts')).rejects.toThrow();
  });

  test.each(['entry', 'package'] as const)(
    'declines oversized %s observations and evicts a large working set',
    async (kind) => {
      const identity = 'i'.repeat(128 * 1024);
      const declaration = '^1.0.0'.padEnd(9 * 1024, ' ');
      const getEntry = vi.fn((path: string) =>
        Promise.resolve({
          path,
          type: 'file',
          byteLength: 0,
          contentIdentity: path === '/large' ? identity : declaration,
        }),
      );
      const discoverPackage = vi.fn((path: string) =>
        Promise.resolve({
          kind: 'observed',
          observation: {
            path,
            compatibility: 'supported',
            declarations: [{ declaredRange: path === '/large' ? identity : declaration }],
          },
        }),
      );
      const session = createInspectionSessionFactory((owner: object) => ({
        owner,
        analyzeSource: (path: string) => path,
        discoverPackage,
        getEntry,
        readFile: () => Promise.resolve(new Uint8Array()),
        getSourceRetainedBytes: () => 65536,
      }))({});
      const observe = (path: string) =>
        kind === 'entry' ? session.getEntry(path) : session.discoverPackage(path);
      const load = kind === 'entry' ? getEntry : discoverPackage;
      await observe('/large');
      await observe('/large');
      expect(load).toHaveBeenCalledTimes(2);
      await observe('/a');
      await observe('/b');
      await observe('/b');
      expect(load).toHaveBeenCalledTimes(4);
      await observe('/a');
      expect(load).toHaveBeenCalledTimes(5);
    },
  );

  test('reparses an evicted source and discards rejected work', async () => {
    const analyzeSource = vi.fn((path: string) => path);
    const readFile = vi.fn(() => Promise.resolve(new Uint8Array()));
    const session = createInspectionSessionFactory((owner: object) => ({
      owner,
      analyzeSource,
      readFile,
      discoverPackage: () => Promise.resolve(null),
      getEntry: () => Promise.resolve(null),
      getSourceRetainedBytes: () => 65536,
    }))({});
    for (let index = 0; index < 17; index += 1) await session.analyzeSource('/' + index + '.ts');
    await session.analyzeSource('/16.ts');
    expect(analyzeSource).toHaveBeenCalledTimes(17);
    await session.analyzeSource('/0.ts');
    expect(analyzeSource).toHaveBeenCalledTimes(18);
    readFile.mockRejectedValueOnce(new Error('read failed'));
    await expect(session.analyzeSource('/failed.ts')).rejects.toThrow('read failed');
    await expect(session.analyzeSource('/failed.ts')).resolves.toBe('/failed.ts');
    expect(analyzeSource).toHaveBeenCalledTimes(19);
  });

  test('shares observation count and byte allowances between entries and packages', async () => {
    const getEntry = vi.fn((path: string) => Promise.resolve({ path, type: 'file' }));
    const discoverPackage = vi.fn((path: string) => Promise.resolve({ path, kind: 'package' }));
    const session = createInspectionSessionFactory((owner: object) => ({
      owner,
      analyzeSource: (path: string) => path,
      readFile: () => Promise.resolve(new Uint8Array()),
      discoverPackage,
      getEntry,
      getSourceRetainedBytes: () => 65536,
    }))({});
    for (let index = 0; index < 80; index += 1) {
      await session.getEntry('/' + index);
      await session.discoverPackage('/' + index);
    }
    await expect(session.getEntry('/79')).resolves.toStrictEqual({ path: '/79', type: 'file' });
    await expect(session.discoverPackage('/79')).resolves.toStrictEqual({
      path: '/79',
      kind: 'package',
    });
    expect(getEntry).toHaveBeenCalledTimes(80);
    expect(discoverPackage).toHaveBeenCalledTimes(80);
    await session.getEntry('/0');
    await session.discoverPackage('/0');
    expect(getEntry).toHaveBeenCalledTimes(81);
    expect(discoverPackage).toHaveBeenCalledTimes(81);

    const large = 'x'.repeat(9 * 1024);
    getEntry.mockResolvedValue({ path: large, type: 'file' });
    discoverPackage.mockResolvedValue({ path: large, kind: 'package' });
    await session.getEntry('/large');
    await session.discoverPackage('/large');
    await session.discoverPackage('/large');
    expect(discoverPackage).toHaveBeenCalledTimes(82);
    await session.getEntry('/large');
    expect(getEntry).toHaveBeenCalledTimes(83);
  });

  test('bounds combined source, entry, package, and listing loads across sessions', async () => {
    let active = 0;
    let maximumActive = 0;
    const load = async (path: string) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      active -= 1;
      return path;
    };
    const createSession = createInspectionSessionFactory((owner: object) => ({
      owner,
      analyzeSource: (path: string) => path,
      readFile: async (path: string) => {
        await load(path);
        return new Uint8Array();
      },
      discoverPackage: load,
      getEntry: load,
      getSourceRetainedBytes: () => 65536,
    }));
    const owner = {};
    const first = createSession(owner);
    const second = createSession(owner);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => {
        const path = '/' + index;
        return Promise.all([
          first.analyzeSource(path),
          second.getEntry(path),
          first.discoverPackage(path),
          second.runLoad(() => load(path)),
        ]);
      }),
    );
    expect(results).toStrictEqual(
      Array.from({ length: 8 }, (_, index) => Array.from({ length: 4 }, () => '/' + index)),
    );
    expect(maximumActive).toBe(4);
    expect(active).toBe(0);
  });

  test('does not start cancelled queued work and recovers shared admission after failure', async () => {
    const getEntry = vi.fn((path: string) => Promise.resolve(path));
    const createSession = createInspectionSessionFactory(
      (context: { owner: object; signal?: AbortSignal }) => ({
        owner: context.owner,
        ...(context.signal === undefined ? {} : { signal: context.signal }),
        analyzeSource: (path: string) => path,
        readFile: () => Promise.resolve(new Uint8Array()),
        discoverPackage: () => Promise.resolve(null),
        getEntry,
        getSourceRetainedBytes: () => 65536,
      }),
    );
    const owner = {};
    const session = createSession({ owner });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const failure = new Error('listing failed');
    const started = vi.fn();
    const running = Promise.allSettled(
      Array.from({ length: 4 }, (_, index) =>
        session.runLoad(async () => {
          started();
          await blocked;
          if (index === 0) throw failure;
          return index;
        }),
      ),
    );
    await Promise.resolve();
    expect(started).toHaveBeenCalledTimes(4);
    const controller = new AbortController();
    const queued = createSession({ owner, signal: controller.signal }).getEntry('/queued');
    const cancelled = new Error('queued inspection cancelled');
    const rejected = expect(queued).rejects.toBe(cancelled);
    controller.abort(cancelled);
    release();
    await expect(running).resolves.toStrictEqual([
      { status: 'rejected', reason: failure },
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
      { status: 'fulfilled', value: 3 },
    ]);
    await rejected;
    expect(getEntry).not.toHaveBeenCalled();
    await expect(session.getEntry('/after')).resolves.toBe('/after');
    expect(getEntry).toHaveBeenCalledTimes(1);
  });
  test('borrows one oversized runtime analysis within an invocation without extending residency', async () => {
    const analyzeSource = vi.fn((path: string) => path);
    const readFile = vi.fn(() => Promise.resolve(new Uint8Array(524_288)));
    const createSession = createInspectionSessionFactory((owner: object) => ({
      owner,
      activeSourcePath: '/runtime.ts',
      analyzeSource,
      readFile,
      discoverPackage: () => Promise.resolve(null),
      getEntry: () => Promise.resolve(null),
      getSourceRetainedBytes: () => 16 * 1024 * 1024 + 1,
    }));
    const owner = {};
    const first = createSession(owner);
    await first.analyzeSource('/runtime.ts');
    await first.analyzeSource('/other.ts');
    await first.analyzeSource('/runtime.ts');
    expect(analyzeSource).toHaveBeenCalledTimes(2);
    await createSession(owner).analyzeSource('/runtime.ts');
    expect(analyzeSource).toHaveBeenCalledTimes(3);
    readFile.mockRejectedValueOnce(new Error('read interrupted'));
    const retry = createSession(owner);
    await expect(retry.analyzeSource('/runtime.ts')).rejects.toThrow('read interrupted');
    await expect(retry.analyzeSource('/runtime.ts')).resolves.toBe('/runtime.ts');
    expect(analyzeSource).toHaveBeenCalledTimes(4);
  });
});
