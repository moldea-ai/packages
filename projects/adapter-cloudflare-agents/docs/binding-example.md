---
title: Binding example
description: Complete manifest and source files for inspecting cloudflare-agents bindings locally.
order: 5
---

# Binding example

Read this example before searching adapter implementation for binding syntax. It is a complete **static inspection** file set, not a deployment starter or a live provider test. The files are checked together through this adapter and Core without installing or executing the target SDK. Keep application setup, credentials, provider model access, tool execution, and deployment configuration separate.

## How the bindings connect

Both exported classes are bound separately. Think connects `getSystemPrompt` and the closed `getTools` map; it has no agent input/output schema evidence. AIChatAgent connects its direct `streamText` call and `Output.object` schema. `agentTool` supplies the exact target routing description. Function tools bind `execute`, `inputSchema`, and `outputSchema`. The Markdown imports require the application's Worker text-module configuration; this is not a deployable Worker scaffold.

Paths below are repository-root-relative logical paths. Keep the canonical instructions as the policy source. General manifest semantics belong to the [Repository Format specification](https://packages.moldea.ai/repository-format/). Use the other local guides for the full supported boundary and limitations; this example does not expand them.

## Files

<!-- example:start -->

### /moldea/moldea.yaml

```yaml
version: 1
agents:
  support:
    runtime:
      id: 'cloudflare-agents'
    bindings:
      runtimeAgent:
        path: '/src/agents.ts'
        symbol: 'SupportAgent'
      instructionLoader:
        path: '/src/instructions.ts'
        symbol: 'loadSupportInstruction'
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
      id: 'cloudflare-agents'
    bindings:
      runtimeAgent:
        path: '/src/agents.ts'
        symbol: 'SummaryAgent'
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
    "@cloudflare/think": "^0.16.0",
    "@cloudflare/ai-chat": "^0.10.2",
    "agents": "^0.21.0",
    "ai": "^7.0.0",
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

### /moldea/agents/summary/handoff-description.md

```markdown
Summarizes a support request.
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
export const SummaryOutputSchema = z.object({ summary: z.string() });
export const FindOrderInputSchema = z.object({ orderId: z.string() });
export const FindOrderOutputSchema = z.object({
  orderId: z.string(),
  status: z.enum(['shipped', 'not_found']),
});
```

### /src/instructions.ts

```typescript
import supportInstruction from '../moldea/agents/support/instruction.md';
import summaryInstruction from '../moldea/agents/summary/instruction.md';

/** Loads the canonical support text through the Worker text-module loader. */
export const loadSupportInstruction = () => supportInstruction;
/** Loads the canonical summary text through the Worker text-module loader. */
export const loadSummaryInstruction = () => summaryInstruction;
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
import { AIChatAgent } from '@cloudflare/ai-chat';
import { Think } from '@cloudflare/think';
import { agentTool } from 'agents/agent-tools';
import { Output, streamText } from 'ai';
import { SummaryOutputSchema } from './contracts.js';
import { loadSummaryInstruction, loadSupportInstruction } from './instructions.js';
import { findOrderTool } from './tools.js';

export class SummaryAgent extends AIChatAgent {
  onChatMessage(_onFinish: unknown, _options?: unknown) {
    return streamText({
      model: 'openai/gpt-5',
      prompt: 'Summarize this support request.',
      instructions: loadSummaryInstruction(),
      output: Output.object({ schema: SummaryOutputSchema }),
      tools: { find_order: findOrderTool },
    });
  }
}

export const summaryHandoffTool = agentTool(SummaryAgent, {
  description: 'Summarizes a support request.',
});

export class SupportAgent extends Think {
  getSystemPrompt() {
    return loadSupportInstruction();
  }
  getTools() {
    return { find_order: findOrderTool, summarize: summaryHandoffTool };
  }
}
```

### /src/assets.d.ts

```typescript
declare module '*.md' {
  const text: string;
  export default text;
}
```

<!-- example:end -->

## What the check establishes

The integration check reads these exact file blocks, requires positive adapter evidence for the documented relationships, and rejects a broken runtime binding. It does not prove that instructions are followed, that every SDK version accepts these forms, or that the application is ready for production. Continue using the installed adapter diagnostics for your actual source.
