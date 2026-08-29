// one file in a deliberately marked complete repository example
export interface IRepositoryFormatExampleFile {
  content: string;
  language: string;
  path: string;
}

// one complete repository example assembled from marked specification fences
export interface IRepositoryFormatCompleteExample {
  files: IRepositoryFormatExampleFile[];
  id: string;
}

// authoritative Repository Format content consumed by generated website surfaces
export interface IRepositoryFormatSpecification {
  completeExamples: IRepositoryFormatCompleteExample[];
  description: string;
  formatVersion: 1;
  markdown: string;
  propertyPaths: string[];
  route: '/repository-format/';
  sourcePath: 'specifications/repository-format.md';
  sourceUrl: string;
  title: string;
}
