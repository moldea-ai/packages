---
title: Binding example
description: Complete manifest and source files for inspecting vercel-ai-sdk bindings locally.
order: 5
---

# Binding example

Read this example before searching adapter implementation for binding syntax. It is a complete **static inspection** file set, not a deployment starter or a live provider test. The files are checked together through this adapter and Core without installing or executing the target SDK. Keep application setup, credentials, provider model access, tool execution, and deployment configuration separate.

## How the bindings connect

The `ToolLoopAgent` binding points to an exported constructor result; `callOptionsSchema` is its agent input and `Output.object` its output. The direct-generation binding points to an exported function containing `streamText`. Both call canonical loaders and reference a closed tool map, whose keys name the tools. This target does not establish handoff evidence. Provider setup and consuming the stream remain application-owned.

Paths below are repository-root-relative logical paths. Keep the canonical instructions as the policy source. General manifest semantics belong to the [Repository Format specification](https://packages.moldea.ai/repository-format/). Use the other local guides for the full supported boundary and limitations; this example does not expand them.

## Files

<!-- example:start -->

### /moldea/moldea.yaml

```yaml
version: 1
agents:
  support:
    runtime:
      id: 'vercel-ai-sdk'
    bindings:
      runtimeAgent:
        path: '/src/agents.ts'
        symbol: 'supportAgent'
      instructionLoader:
        path: '/src/instructions.ts'
        symbol: 'loadSupportInstruction'
      inputSchema:
        path: '/src/contracts.ts'
        symbol: 'SupportInputSchema'
      outputSchema:
        path: '/src/contracts.ts'
        symbol: 'SupportOutputSchema'
    tools:
      find-order:
        name: 'find_order'
        description: 'Finds an order.'
        implementation:
          path: '/src/implementations.ts'
          symbol: 'findOrder'
        registration:
          path: '/src/tools.ts'
          symbol: 'findOrderTool'
        inputSchema:
          path: '/src/contracts.ts'
          symbol: 'FindOrderInputSchema'
        outputSchema:
          path: '/src/contracts.ts'
          symbol: 'FindOrderOutputSchema'
  summary:
    runtime:
      id: 'vercel-ai-sdk'
    bindings:
      runtimeAgent:
        path: '/src/agents.ts'
        symbol: 'summaryAgent'
      instructionLoader:
        path: '/src/instructions.ts'
        symbol: 'loadSummaryInstruction'
      outputSchema:
        path: '/src/contracts.ts'
        symbol: 'SummaryOutputSchema'
    tools:
      find-order:
        name: 'find_order'
        description: 'Finds an order.'
        implementation:
          path: '/src/implementations.ts'
          symbol: 'findOrder'
        registration:
          path: '/src/tools.ts'
          symbol: 'findOrderTool'
        inputSchema:
          path: '/src/contracts.ts'
          symbol: 'FindOrderInputSchema'
        outputSchema:
          path: '/src/contracts.ts'
          symbol: 'FindOrderOutputSchema'
```

### /package.json

```json
{
  "dependencies": {
    "ai": "^7.0.66",
    "zod": "4.6.4"
  },
  "name": "binding-example",
  "private": true,
  "type": "module"
}
```

### /moldea/project.md

```markdown
# Fixture project
```

### /moldea/agents/support/description.md

```markdown
Supports customers.
```

### /moldea/agents/support/instruction.md

```markdown
You are the `support` agent.

Answer from supplied support facts. Do not invent order status or account information.
```

### /moldea/agents/summary/description.md

```markdown
Summarizes requests.
```

### /moldea/agents/summary/instruction.md

```markdown
You are the `summary` agent.

Summarize the supplied support request without inventing facts.
```

### /src/contracts.ts

```typescript
import { z } from 'zod';

// response and tool contracts
export const SupportInputSchema = z.object({ request: z.string() });
export const SupportOutputSchema = z.object({ summary: z.string() });
export const SummaryOutputSchema = z.object({ summary: z.string() });
export const FindOrderInputSchema = z.object({ orderId: z.string() });
export const FindOrderOutputSchema = z.object({
  orderId: z.string(),
  status: z.enum(['shipped', 'not_found']),
});
```

### /src/instructions.ts

```typescript
import { readFileSync } from 'node:fs';

/** Reads the canonical support instruction. */
export const loadSupportInstruction = (): string =>
  readFileSync(new URL('../moldea/agents/support/instruction.md', import.meta.url), 'utf8');

/** Reads the canonical summary instruction. */
export const loadSummaryInstruction = (): string =>
  readFileSync(new URL('../moldea/agents/summary/instruction.md', import.meta.url), 'utf8');
```

### /src/implementations.ts

```typescript
/** Looks up an order in the example's fixed catalog. */
export const findOrder = async ({ orderId }: { orderId: string }) => ({
  orderId,
  status: orderId === 'order-1042' ? ('shipped' as const) : ('not_found' as const),
});
```

### /src/tools.ts

```typescript
import { tool } from 'ai';
import { FindOrderInputSchema, FindOrderOutputSchema } from './contracts.js';
import { findOrder } from './implementations.js';
export const findOrderTool = tool({
  inputSchema: FindOrderInputSchema,
  outputSchema: FindOrderOutputSchema,
  execute: findOrder,
});
```

### /src/agents.ts

```typescript
import { Output, streamText, ToolLoopAgent } from 'ai';
import { SupportInputSchema, SupportOutputSchema, SummaryOutputSchema } from './contracts.js';
import { loadSummaryInstruction, loadSupportInstruction } from './instructions.js';
import { findOrderTool } from './tools.js';
export const supportAgent = new ToolLoopAgent({
  model: 'openai/gpt-5',
  id: 'support-runtime',
  instructions: loadSupportInstruction(),
  callOptionsSchema: SupportInputSchema,
  output: Output.object({ schema: SupportOutputSchema }),
  tools: { find_order: findOrderTool },
});
export const summaryAgent = async () =>
  streamText({
    model: 'openai/gpt-5',
    prompt: 'Summarize this support request.',
    instructions: await loadSummaryInstruction(),
    output: Output.object({ schema: SummaryOutputSchema }),
    tools: { find_order: findOrderTool },
  });
```

<!-- example:end -->

## What the check establishes

The integration check reads these exact file blocks, requires positive adapter evidence for the documented relationships, and rejects a broken runtime binding. It does not prove that instructions are followed, that every SDK version accepts these forms, or that the application is ready for production. Continue using the installed adapter diagnostics for your actual source.
