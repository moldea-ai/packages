// one immutable SDK package used by a disposable compatibility consumer
export interface IUpstreamTarget {
  readonly companionPackages: readonly string[];
  readonly family:
    'ai-sdk' | 'anthropic' | 'claude-agent-sdk' | 'cloudflare-think' | 'google-genai' | 'openai';
  readonly fixture: 'minimum' | 'boundary' | 'current';
  readonly integrity: string;
  readonly packageName: string;
  readonly sourceReference: string;
  readonly version: string;
}

// one completed real-package verification result
export interface IUpstreamResult extends IUpstreamTarget {
  readonly requestPreparationChecked: boolean;
}
