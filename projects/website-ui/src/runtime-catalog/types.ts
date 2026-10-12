// a runtime label and its package-exported, static icon assets; no compatibility claim
export interface IRuntimeCatalogEntry {
  id: string;
  displayName: string;
  websiteUrl: string;
  logoPath: string;
  darkLogoPath?: string;
  logoSize?: 'padded-icon';
}
