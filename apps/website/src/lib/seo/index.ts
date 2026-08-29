// page metadata scoped to one package or documentation owner
interface ISeoMetadata {
  description: string;
  title: string;
}

/**
 * Qualifies generic documentation metadata with its owning package.
 * @param title The document title.
 * @param description The document description.
 * @param ownerName The package or documentation owner shown in search results.
 * @returns Unique metadata that retains the source document wording.
 */
export const createScopedSeoMetadata = (
  title: string,
  description: string,
  ownerName: string,
): ISeoMetadata => ({
  description: `${ownerName}: ${description}`,
  title: `${title} · ${ownerName}`,
});
