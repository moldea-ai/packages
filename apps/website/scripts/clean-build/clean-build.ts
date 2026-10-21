import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from 'jg-process';

/**
 * Removes website-owned output before a build or cache restore so retired pages cannot survive.
 * @param websiteDirectory Trusted application directory; defaults to this script's owning app.
 */
export const cleanWebsiteBuild = (
  websiteDirectory = fileURLToPath(new URL('../../', import.meta.url)),
): void => {
  for (const directory of ['dist', '.generated']) {
    rmSync(join(websiteDirectory, directory), { recursive: true, force: true });
  }
};

if (isMainModule(import.meta.url)) {
  cleanWebsiteBuild();
}
