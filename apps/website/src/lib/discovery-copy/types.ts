// display-only descriptions; canonical package identities remain source-owned
export interface IPackageDiscoveryCopy {
  name: string;
  description: string;
}

export interface IDiscoveryCopy {
  packages: Record<string, IPackageDiscoveryCopy>;
}
