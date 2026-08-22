// host-sensitive behavior for logical paths that differ only by case
export type IRepositoryReaderCasePathFixture =
  | {
      readonly kind: 'distinct';
      readonly paths: readonly [string, string];
    }
  | {
      readonly existingPath: string;
      readonly kind: 'mismatch';
      readonly missingPath: string;
    };

// structural reader contract that avoids coupling test consumers to one package build location
export interface IRepositoryReaderConformanceEntry<TPath extends string> {
  readonly path: TPath;
  readonly type: 'file' | 'directory' | 'symlink';
}

// source-neutral reader operations exercised by the shared conformance contract
export interface IRepositoryReaderConformanceReader<TPath extends string> {
  readonly getEntry: (
    path: TPath,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<IRepositoryReaderConformanceEntry<TPath> | null>;
  readonly listEntries: (options?: {
    readonly prefix?: TPath;
    readonly signal?: AbortSignal;
  }) => AsyncIterable<IRepositoryReaderConformanceEntry<TPath>>;
  readonly readFile: (
    path: TPath,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Uint8Array>;
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
  readonly expectedEntries: readonly IRepositoryReaderConformanceEntry<TPath>[];
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

// source mutation scenario used to verify snapshot behavior after reader creation
export interface IRepositoryReaderSnapshotMutationFixture<TPath extends string> {
  readonly behavior: 'preserve-snapshot' | 'report-snapshot-changed';
  readonly mutateSource: () => Promise<void> | void;
  readonly reader: IRepositoryReaderConformanceReader<TPath>;
}
