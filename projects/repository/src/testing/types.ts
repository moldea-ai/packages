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

// structural link resolution consumed by the installed link-resolver conformance suite
export type IRepositoryLinkResolverConformanceResolution<TPath extends string> =
  | { readonly state: 'not-link' }
  | {
      readonly state: 'inside';
      readonly targetIdentity: string;
      readonly targetPath: TPath;
      readonly targetType: 'directory' | 'file' | 'other';
    }
  | {
      readonly state: 'outside';
      readonly targetIdentity: string;
      readonly targetType: 'directory' | 'file' | 'other';
    }
  | { readonly state: 'broken' | 'denied' | 'loop' | 'unsafe' };

// source-neutral link-resolver operations exercised without package-location coupling
export interface IRepositoryLinkResolverConformanceResolver<TPath extends string> {
  readonly snapshot: { readonly id: string; readonly sourceKind: string };
  readonly readLinkTargetPage: (
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
  readonly resolveLink: (
    path: TPath,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<IRepositoryLinkResolverConformanceResolution<TPath>>;
}

// one prepared link whose final target is a regular file with known bytes
export interface IRepositoryLinkResolverConformanceFileLink {
  readonly bytes: Uint8Array;
  readonly path: string;
}

// one prepared link whose final target lies inside the repository at a known logical path
export interface IRepositoryLinkResolverConformanceInsideLink {
  readonly path: string;
  readonly targetPath: string;
}

// one prepared link and the source change that invalidates its earlier resolution
export interface IRepositoryLinkResolverMutationFixture<TPath extends string> {
  readonly linkPath: string;
  readonly mutateSource: () => Promise<void> | void;
  readonly resolver: IRepositoryLinkResolverConformanceResolver<TPath>;
}

/*
 * Inputs required to run the source-neutral link-resolver conformance contract. Every listed
 * path names a prepared repository entry; host-specific cases a source cannot express, such as
 * denied or special-file targets, are supplied as empty lists.
 */
export interface IRepositoryLinkResolverConformanceFixture<TPath extends string> {
  readonly brokenLinkPaths: readonly string[];
  readonly createResolver: () =>
    | IRepositoryLinkResolverConformanceResolver<TPath>
    | Promise<IRepositoryLinkResolverConformanceResolver<TPath>>;
  readonly createRootReplacementFixture: () =>
    | IRepositoryLinkResolverMutationFixture<TPath>
    | Promise<IRepositoryLinkResolverMutationFixture<TPath>>;
  readonly createTargetReplacementFixture: () =>
    | IRepositoryLinkResolverMutationFixture<TPath>
    | Promise<IRepositoryLinkResolverMutationFixture<TPath>>;
  readonly deniedLinkPaths: readonly string[];
  readonly hostPathFragments: readonly string[];
  readonly insideDirectoryLink: IRepositoryLinkResolverConformanceInsideLink;
  readonly insideFileLink: IRepositoryLinkResolverConformanceFileLink &
    IRepositoryLinkResolverConformanceInsideLink;
  readonly isRepositorySourceException: (cause: unknown) => boolean;
  readonly loopLinkPaths: readonly string[];
  readonly maxReadBytes: number;
  readonly missingPath: string;
  readonly multiHopLink: IRepositoryLinkResolverConformanceFileLink &
    IRepositoryLinkResolverConformanceInsideLink;
  readonly notLinkPaths: readonly string[];
  readonly otherTargetLinkPaths: readonly string[];
  readonly outsideDirectoryLinkPath: string;
  readonly outsideFileLink: IRepositoryLinkResolverConformanceFileLink;
  readonly outsideFileAliasLinkPath: string;
  readonly outsideOtherFileLink: IRepositoryLinkResolverConformanceFileLink;
  readonly parentAfterDirectoryLinks: {
    readonly inside: IRepositoryLinkResolverConformanceFileLink &
      IRepositoryLinkResolverConformanceInsideLink;
    readonly outside: IRepositoryLinkResolverConformanceFileLink;
  };
  readonly parsePath: (candidate: string) => TPath;
  readonly unsafeLinkPaths: readonly string[];
}
