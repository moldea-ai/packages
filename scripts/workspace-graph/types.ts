// committed workspace facts shared by release selection and CI
export interface IWorkspacePackageState {
  directory: string;
  isPrivate: boolean;
  name: string;
  scripts: string[];
  workspaceDependencies: string[];
}
