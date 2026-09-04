import {
  parseRepositoryPath,
  type IRepositoryPath,
  type IRepositoryReader,
} from '@moldea.ai/repository';
// @ts-expect-error The Repository FS package has no default export.
import repositoryFilesystemDefault from '@moldea.ai/repository-fs';
import {
  DEFAULT_FILESYSTEM_REPOSITORY_RESOURCE_LIMITS,
  createFilesystemRepositoryReader,
  type IFilesystemRepositoryDirectorySelection,
  type IFilesystemRepositoryPathSelection,
  type IFilesystemRepositoryReaderOptions,
  type IFilesystemRepositoryResourceLimits,
  type IFilesystemRepositorySelection,
} from '@moldea.ai/repository-fs';

const selectedPath: IRepositoryPath = parseRepositoryPath('/moldea/moldea.yaml');
const pathSelection: IFilesystemRepositoryPathSelection = {
  kind: 'paths',
  paths: [selectedPath],
};
const directorySelection: IFilesystemRepositoryDirectorySelection = { kind: 'directory' };
const selections: readonly IFilesystemRepositorySelection[] = [pathSelection, directorySelection];
const limits: IFilesystemRepositoryResourceLimits = {
  ...DEFAULT_FILESYSTEM_REPOSITORY_RESOURCE_LIMITS,
};
const options: IFilesystemRepositoryReaderOptions = {
  limits,
  rootDirectory: '/absolute/repository/root',
  selection: pathSelection,
  signal: new AbortController().signal,
};
const reader: Promise<IRepositoryReader> = createFilesystemRepositoryReader(options);

void repositoryFilesystemDefault;
void reader;
void selections;
void options;
