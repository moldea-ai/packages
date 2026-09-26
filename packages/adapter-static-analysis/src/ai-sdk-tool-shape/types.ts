import type ts from 'typescript';

// static state of the AI SDK deferred-loading option
export type IAiSdkDeferredLoading = 'absent' | 'enabled' | 'disabled' | 'unknown';

// closed function-tool declaration fields shared by AI SDK consumers
export interface IAiSdkFunctionToolShape {
  readonly deferLoading: ts.Expression | null;
}
