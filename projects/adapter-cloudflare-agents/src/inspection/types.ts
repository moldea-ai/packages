import type { IIndexedAgent } from '@moldea.ai/core/adapter';

import type {
  ICloudflareAgentsClassDefinition,
  ICloudflareAgentsGenerationRequest,
  ICloudflareAgentsRelationship,
  ICloudflareAgentsSourceAnalysis,
} from '../contracts/index.js';

// supported runtime agent retained for relationship inspection
export type ICloudflareAgentsScopedAgent = Pick<IIndexedAgent, 'declaration' | 'id'>;

export interface ICloudflareAgentsInspectedAgent {
  readonly agent: ICloudflareAgentsScopedAgent;
  readonly analysis: ICloudflareAgentsSourceAnalysis;
  readonly definition: ICloudflareAgentsClassDefinition;
  readonly instructions: ICloudflareAgentsRelationship;
  readonly output: ICloudflareAgentsRelationship;
  readonly requests: readonly ICloudflareAgentsGenerationRequest[];
  readonly tools: readonly ICloudflareAgentsRelationship[];
}
