// host-sensitive behavior for logical paths that differ only by case
export type IRepositoryReaderCasePathFixture =
  | { readonly kind: 'distinct'; readonly paths: readonly [string, string] }
  | { readonly existingPath: string; readonly kind: 'mismatch'; readonly missingPath: string };

// structural entry contract consumed by the installed conformance suite
export interface IRepositoryReaderConformanceEntry<TPath extends string> {
  readonly byteLength: number | null;
  readonly contentIdentity: string | null;
  readonly path: TPath;
  readonly type: 'file' | 'directory' | 'symlink';
}

// structural page contract consumed by the installed conformance suite
export interface IRepositoryReaderConformancePage<TPath extends string> {
  readonly entries: readonly IRepositoryReaderConformanceEntry<TPath>[];
  readonly isComplete: boolean;
  readonly nextCursor: string | null;
  readonly snapshot: { readonly id: string; readonly sourceKind: string };
}

// source-neutral reader operations exercised without package-location coupling
export interface IRepositoryReaderConformanceReader<TPath extends string> {
  readonly snapshot: { readonly id: string; readonly sourceKind: string };
  readonly getEntry: (
    path: TPath,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<IRepositoryReaderConformanceEntry<TPath> | null>;
  readonly listEntriesPage: (options: {
    readonly cursor?: string;
    readonly maxEntries: number;
    readonly prefix?: TPath;
    readonly signal?: AbortSignal;
  }) => Promise<IRepositoryReaderConformancePage<TPath>>;
  readonly readFilePage: (
    path: TPath,
    options: { readonly maxBytes: number; readonly offset: number; readonly signal?: AbortSignal },
  ) => Promise<{
    readonly bytes: Uint8Array;
    readonly isComplete: boolean;
    readonly nextOffset: number | null;
    readonly offset: number;
    readonly snapshot: { readonly id: string; readonly sourceKind: string };
    readonly totalBytes: number;
  }>;
  readonly readLinkText: (
    path: TPath,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<string | null>;
}

// inputs required to run the source-neutral reader conformance contract
export interface IRepositoryReaderConformanceFixture<TPath extends string> {
  readonly casePaths: IRepositoryReaderCasePathFixture;
  readonly createReader: () =>
    IRepositoryReaderConformanceReader<TPath> | Promise<IRepositoryReaderConformanceReader<TPath>>;
  readonly createSnapshotMutationFixture: () =>
    | IRepositoryReaderSnapshotMutationFixture<TPath>
    | Promise<IRepositoryReaderSnapshotMutationFixture<TPath>>;
  readonly emptyFilePath: string;
  readonly expectedEntries: readonly Pick<
    IRepositoryReaderConformanceEntry<TPath>,
    'path' | 'type'
  >[];
  readonly fileBytes: Uint8Array;
  readonly filePath: string;
  readonly isRepositoryPathException: (cause: unknown) => boolean;
  readonly isRepositorySourceException: (cause: unknown) => boolean;
  readonly missingPath: string;
  readonly nestedDirectoryPath: string;
  readonly nestedExpectedPaths: readonly string[];
  readonly parsePath: (candidate: string) => TPath;
  readonly rootPath: TPath;
  readonly symlinkPath: string;
  readonly symlinkText: string;
  readonly unicodePath: string;
  // symlinks whose text is longer than 4096 UTF-8 bytes or not valid UTF-8, when the source can store them
  readonly unreadableSymlinkPaths: readonly string[];
}

// source mutation scenario used to verify snapshot behavior
export interface IRepositoryReaderSnapshotMutationFixture<TPath extends string> {
  readonly behavior: 'preserve-snapshot' | 'report-snapshot-changed';
  readonly mutateSource: () => Promise<void> | void;
  readonly reader: IRepositoryReaderConformanceReader<TPath>;
}

// synchronous assertions the conformance suite makes, as Vitest's expect provides them
export interface IRepositoryReaderConformanceMatchers {
  toBe(expected: unknown): void;
  toBeGreaterThan(expected: number): void;
  toMatchObject(expected: object): void;
  toStrictEqual(expected: unknown): void;
}

// assertions the conformance suite awaits on a promise's resolved value
export interface IRepositoryReaderConformanceAsyncMatchers {
  toBe(expected: unknown): PromiseLike<void>;
  toBeNull(): PromiseLike<void>;
  toMatchObject(expected: object): PromiseLike<void>;
  toStrictEqual(expected: unknown): PromiseLike<void>;
}

// the assertion one expect call returns
export interface IRepositoryReaderConformanceAssertion extends IRepositoryReaderConformanceMatchers {
  readonly not: Pick<IRepositoryReaderConformanceMatchers, 'toBe'>;
  readonly resolves: IRepositoryReaderConformanceAsyncMatchers;
}

/*
 * The test functions the conformance suite registers its checks with, such as Vitest's describe,
 * test, and expect. The caller passes them, so the package never imports a test runner, and this
 * contract covers only the calls the suite makes.
 */
export interface IRepositoryReaderConformanceRunner {
  readonly describe: (name: string, body: () => void) => unknown;
  readonly test: (name: string, body: () => Promise<void>) => unknown;
  readonly expect: (actual: unknown) => IRepositoryReaderConformanceAssertion;
}
