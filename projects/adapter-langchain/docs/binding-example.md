---
title: Binding example
description: Complete manifest and source files for inspecting langchain bindings locally.
order: 5
---

# Binding example

Read this example before searching adapter implementation for binding syntax. It is a complete **static inspection** file set, not a deployment starter or a live provider test. The files are checked together through this adapter and Core without installing or executing the target SDK. Keep application setup, credentials, provider model access, tool execution, and deployment configuration separate.

## How the bindings connect

Bind the exported `createAgent` result. `systemPrompt` calls the canonical loader, `responseFormat` uses the bound agent output schema, and each tool has a distinct implementation, registration, and input schema. The example uses no middleware: unknown middleware can leave relationships unresolved. This target does not establish handoff, agent input-schema, or tool output-schema evidence.

Paths below are repository-root-relative logical paths. Keep the canonical instructions as the policy source. General manifest semantics belong to the [Repository Format specification](https://packages.moldea.ai/repository-format/). Use the other local guides for the full supported boundary and limitations; this example does not expand them.

## Files

<!-- example:start -->

### /moldea/moldea.yaml

```yaml
version: 1
agents:
  support:
    runtime:
      id: 'langchain'
    bindings:
      runtimeAgent:
        path: '/src/agent.ts'
        symbol: 'supportAgent'
      instructionLoader:
        path: '/src/instructions.ts'
        symbol: 'loadSupportInstruction'
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
```

### /package.json

```json
{
  "dependencies": {
    "@langchain/core": "~1.2.8",
    "langchain": "~1.5.9",
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

### /src/contracts.ts

```typescript
import { z } from 'zod';

// response and tool contracts
export const SupportOutputSchema = z.object({ summary: z.string() });
export const FindOrderInputSchema = z.object({ orderId: z.string() });
```

### /src/instructions.ts

```typescript
import { readFileSync } from 'node:fs';

/** Reads the canonical support instruction. */
export const loadSupportInstruction = (): string =>
  readFileSync(new URL('../moldea/agents/support/instruction.md', import.meta.url), 'utf8');
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
import { tool } from '@langchain/core/tools';
import { FindOrderInputSchema } from './contracts.js';
import { findOrder } from './implementations.js';
export const findOrderTool = tool(findOrder, {
  name: 'find_order',
  description: 'Finds an order.',
  schema: FindOrderInputSchema,
});
```

### /src/agent.ts

```typescript
import { createAgent, providerStrategy, SystemMessage } from 'langchain';
import { SupportOutputSchema } from './contracts.js';
import { loadSupportInstruction } from './instructions.js';
import { findOrderTool } from './tools.js';
const MIDDLEWARE = [];
const TOOLS = [findOrderTool];
export const supportAgent = createAgent({
  model: 'openai:gpt-4o',
  name: 'support-runtime',
  systemPrompt: new SystemMessage(loadSupportInstruction()),
  responseFormat: providerStrategy({ schema: SupportOutputSchema, strict: true }),
  middleware: MIDDLEWARE,
  tools: TOOLS,
});
```

<!-- example:end -->

## What the check establishes

The integration check reads these exact file blocks, requires positive adapter evidence for the documented relationships, and rejects a broken runtime binding. It does not prove that instructions are followed, that every SDK version accepts these forms, or that the application is ready for production. Continue using the installed adapter diagnostics for your actual source.
