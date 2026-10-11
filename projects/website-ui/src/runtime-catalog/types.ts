// a runtime label and its package-exported, static SVG assets; no compatibility claim
export interface IRuntimeCatalogEntry {
  id: string;
  displayName: string;
  logoPath: string;
  darkLogoPath?: string;
}
