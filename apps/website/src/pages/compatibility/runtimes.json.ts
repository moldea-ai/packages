import type { APIRoute } from 'astro';

import { loadWebsiteModel } from '../../lib/generation/generation.ts';
import { createRuntimeCompatibilityResponse } from '../../lib/runtime-compatibility-response/index.ts';

export const prerender = true;

/** Serves the deterministic technical compatibility and target maturity publication. */
export const GET: APIRoute = () => {
  const publication = loadWebsiteModel().runtimeCompatibilityPublication;

  return createRuntimeCompatibilityResponse(publication);
};
