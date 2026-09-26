// one immutable SDK package used by a disposable compatibility consumer
export interface IUpstreamTarget {
  readonly companionPackages: readonly string[];
  readonly family:
    | 'ai-sdk'
    | 'anthropic'
    | 'claude-agent-sdk'
    | 'cloudflare-think'
    | 'eve'
    | 'google-genai'
    | 'openai';
  readonly fixture:
    | 'minimum'
    | 'boundary'
    | 'agent-options-boundary'
    | 'visibility-boundary'
    | 'exposure-before'
    | 'exposure-boundary'
    | 'defaults-boundary'
    | 'exclusion-boundary'
    | 'current';
  readonly integrity: string;
  readonly packageName: string;
  readonly sourceReference: string;
  readonly version: string;
}

// one completed real-package verification result
export interface IUpstreamResult extends IUpstreamTarget {
  readonly compilerChecked?: boolean;
  readonly requestPreparationChecked: boolean;
}
