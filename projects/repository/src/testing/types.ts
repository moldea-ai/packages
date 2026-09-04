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
  readonly unicodePath: string;
}

// source mutation scenario used to verify snapshot behavior
export interface IRepositoryReaderSnapshotMutationFixture<TPath extends string> {
  readonly behavior: 'preserve-snapshot' | 'report-snapshot-changed';
  readonly mutateSource: () => Promise<void> | void;
  readonly reader: IRepositoryReaderConformanceReader<TPath>;
}
