import type { IIndexedAgent } from '@moldea.ai/core/adapter';

import type {
  ICloudflareAgentsClassDefinition,
  ICloudflareAgentsGenerationRequest,
  ICloudflareAgentsRelationship,
  ICloudflareAgentsSourceAnalysis,
  ICloudflareAgentsThinkContextSources,
  ICloudflareAgentsThinkSessionSources,
} from '../contracts/index.js';
import type { ICloudflareAgentsPackageInspection } from './package-inspection.js';

// supported runtime agent retained for relationship inspection
export type ICloudflareAgentsScopedAgent = Pick<IIndexedAgent, 'declaration' | 'id'>;

export interface ICloudflareAgentsThinkInstructions {
  readonly context: ICloudflareAgentsThinkContextSources;
  readonly package: ICloudflareAgentsPackageInspection;
  readonly session: ICloudflareAgentsThinkSessionSources;
  readonly systemPrompt: ICloudflareAgentsRelationship;
}

export interface ICloudflareAgentsInspectedAgent {
  readonly agent: ICloudflareAgentsScopedAgent;
  readonly analysis: ICloudflareAgentsSourceAnalysis;
  readonly definition: ICloudflareAgentsClassDefinition;
  readonly instructions: ICloudflareAgentsRelationship;
  readonly output: ICloudflareAgentsRelationship;
  readonly requests: readonly ICloudflareAgentsGenerationRequest[];
  readonly thinkInstructions: ICloudflareAgentsThinkInstructions | null;
  readonly tools: readonly ICloudflareAgentsRelationship[];
}
