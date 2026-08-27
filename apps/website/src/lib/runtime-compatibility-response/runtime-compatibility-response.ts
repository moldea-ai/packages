import {
  serializeRuntimeCompatibilityPublication,
  type IRuntimeCompatibilityPublicationV1,
} from '../runtime-compatibility-publication/index.ts';

/**
 * Creates the public HTTP response for one runtime compatibility publication.
 * @param publication The combined technical compatibility and maturity model.
 * @returns A compact deterministic JSON response.
 */
export const createRuntimeCompatibilityResponse = (
  publication: IRuntimeCompatibilityPublicationV1,
): Response =>
  new Response(serializeRuntimeCompatibilityPublication(publication), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
