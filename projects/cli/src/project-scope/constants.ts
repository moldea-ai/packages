import { parseRepositoryPath } from '@moldea.ai/repository';

// only canonical asset required for changed-path relationship matching
export const MOLDEA_MANIFEST_PATH = parseRepositoryPath('/moldea/moldea.yaml');
