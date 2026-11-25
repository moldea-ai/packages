// an SDK or framework and its package-exported icon
export interface IRuntimeCatalogEntry {
  id: string;
  displayName: string;
  packageName?: string;
  websiteUrl: string;
  logoPath: string;
  darkLogoPath?: string;
  logoSize?: 'padded-icon';
}
