// display-only descriptions; canonical identities and compatibility remain source-owned
export interface IPackageDiscoveryCopy {
  name: string;
  description: string;
}

export interface IAdapterDiscoveryCopy extends IPackageDiscoveryCopy {
  targets: Record<string, string>;
}

export interface IDiscoveryCopy {
  packages: Record<string, IPackageDiscoveryCopy>;
  adapters: Record<string, IAdapterDiscoveryCopy>;
}
