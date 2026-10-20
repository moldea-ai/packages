import {
  REPOSITORY_LINK_MAX_HOPS,
  REPOSITORY_LINK_TEXT_MAX_BYTES,
  REPOSITORY_ROOT,
  RepositoryPathException,
  RepositorySourceException,
  compareRepositoryPaths,
  createRepositoryComparison,
  createRepositoryIdentity,
  isRepositoryPath,
  parseRepositoryPath,
  resolveRepositoryLink,
  type IRepositoryEntry,
  type IRepositoryEntryPageOptions,
  type IRepositoryEntryType,
  type IRepositoryLinkResolution,
  type IRepositoryLinkSource,
  type IRepositoryOperation,
  type IRepositoryOperationOptions,
  type IRepositoryPath,
  type IRepositoryPathExceptionOptions,
  type IRepositoryReader,
  type IRepositorySourceErrorCode,
  type IRepositorySourceExceptionOptions,
} from '@moldea.ai/repository';
import {
  createMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '@moldea.ai/repository/memory';
import {
  describeRepositoryReaderConformance,
  type IRepositoryReaderConformanceEntry,
} from '@moldea.ai/repository/testing';

const repositoryPath: IRepositoryPath = parseRepositoryPath('/file.txt');
const root: IRepositoryPath = REPOSITORY_ROOT;
const entryType: IRepositoryEntryType = 'file';
const entry: IRepositoryEntry = {
  byteLength: 1,
  contentIdentity: 'fixture:1',
  path: repositoryPath,
  type: entryType,
};
const operationOptions: IRepositoryOperationOptions = {
  signal: new AbortController().signal,
};
const listOptions: IRepositoryEntryPageOptions = {
  maxEntries: 16,
  prefix: root,
  ...operationOptions,
};
const operation: IRepositoryOperation = 'read-file-page';
const sourceCode: IRepositorySourceErrorCode = 'ENTRY_NOT_FOUND';
const pathExceptionOptions: IRepositoryPathExceptionOptions = { cause: new Error('cause') };
const sourceExceptionOptions: IRepositorySourceExceptionOptions = {
  code: sourceCode,
  operation,
  path: repositoryPath,
  retryable: false,
};
const memoryEntries: readonly IMemoryRepositoryEntry[] = [
  { content: new Uint8Array([1]), path: repositoryPath, type: 'file' },
  { path: '/link.txt', target: 'file.txt', type: 'symlink' },
];
const reader: IRepositoryReader = createMemoryRepositoryReader(memoryEntries);
const conformanceEntry: IRepositoryReaderConformanceEntry<IRepositoryPath> = entry;
const conformanceRunner: typeof describeRepositoryReaderConformance =
  describeRepositoryReaderConformance;
const linkSource: IRepositoryLinkSource = reader;
const linkResolution: Promise<IRepositoryLinkResolution> = resolveRepositoryLink(
  linkSource,
  parseRepositoryPath('/link.txt'),
);
const linkText: Promise<string | null> = reader.readLinkText(parseRepositoryPath('/link.txt'));
const linkLimits: readonly number[] = [REPOSITORY_LINK_MAX_HOPS, REPOSITORY_LINK_TEXT_MAX_BYTES];
const pathException = new RepositoryPathException(pathExceptionOptions);
const sourceException = new RepositorySourceException(sourceExceptionOptions);
const comparisonOrder: number = compareRepositoryPaths(root, repositoryPath);
const comparison = createRepositoryComparison(reader, reader);
const identity: string = createRepositoryIdentity([new Uint8Array([1, 2, 3])]);

if (!isRepositoryPath(repositoryPath)) {
  throw new Error('The packaged repository path predicate rejected a valid path.');
}

void [
  entry,
  listOptions,
  reader,
  conformanceEntry,
  conformanceRunner,
  linkResolution,
  linkText,
  linkLimits,
  pathException,
  sourceException,
  comparison,
  comparisonOrder,
  identity,
];

// @ts-expect-error A plain string has not passed runtime repository-path validation.
const forgedPath: IRepositoryPath = '/unvalidated.txt';
void forgedPath;
