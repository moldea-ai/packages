// application-owned files always use portable, root-relative logical paths
export interface IFixtureFile {
  path: string;
  content: string | Uint8Array;
}

// the only filesystem write surface exposed to a fixture operation
export interface IFixtureWorkspace {
  directory: string;
  write: (file: IFixtureFile) => Promise<void>;
}
