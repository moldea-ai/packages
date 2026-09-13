---
title: Binding example
description: Complete manifest and source files for inspecting anthropic bindings locally.
order: 5
---

# Binding example

Read this example before searching adapter implementation for binding syntax. It is a complete **static inspection** file set, not a deployment starter or a live provider test. The files are checked together through this adapter and Core without installing or executing the target SDK. Keep application setup, credentials, provider model access, tool execution, and deployment configuration separate.

## How the bindings connect

The exported `supportAgent` function binds the Messages request. `system` calls the named canonical loader; `input_schema` points to the declared tool input. This target does not inspect agent output schemas, tool output schemas, or handoffs. The application must dispatch tool calls and return their results; declaring a tool does not execute it.

Paths below are repository-root-relative logical paths. Keep the canonical instructions as the policy source. General manifest semantics belong to the [Repository Format specification](https://packages.moldea.ai/repository-format/). Use the other local guides for the full supported boundary and limitations; this example does not expand them.

## Files

<!-- example:start -->

### /moldea/moldea.yaml

```yaml
version: 1
agents:
  support:
    runtime:
      id: 'anthropic'
    bindings:
      runtimeAgent:
        path: '/src/agent.ts'
        symbol: 'supportAgent'
      instructionLoader:
        path: '/src/instructions.ts'
        symbol: 'loadInstruction'
    tools:
      find-order:
        name: 'find_order'
        description: 'Retrieves one order by its identifier.'
        implementation:
          path: '/src/find-order.ts'
          symbol: 'findOrder'
        registration:
          path: '/src/find-order.ts'
          symbol: 'findOrderTool'
        inputSchema:
          path: '/src/contracts.ts'
          symbol: 'FindOrderInput'
```

### /moldea/project.md

```markdown
# Anthropic adapter fixture
```

### /moldea/agents/support/description.md

```markdown
Support agent.
```

### /moldea/agents/support/instruction.md

```markdown
You are the `support` agent.

Answer from supplied support facts. Do not invent order status or account information.
```

### /package.json

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.117.1"
  },
  "name": "binding-example",
  "private": true,
  "type": "module"
}
```

### /src/agent.ts

```typescript
import AnthropicClient from '@anthropic-ai/sdk';

import { findOrderTool as registeredFindOrder } from './find-order.js';
import { loadInstruction as readInstruction } from './instructions.js';

const client = new AnthropicClient();

export const supportAgent = async () =>
  client.messages.create({
    model: 'claude-sonnet-4-5',
    system: readInstruction(),
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Help with order-1042.' }],
    tools: [registeredFindOrder],
  });
```

### /src/contracts.ts

```typescript
export const FindOrderInput = {
  additionalProperties: false,
  properties: { orderId: { type: 'string' } },
  required: ['orderId'],
  type: 'object',
} as const;
```

### /src/find-order.ts

```typescript
import { FindOrderInput } from './contracts.js';

/** Looks up an order in the example's fixed catalog. */
export const findOrder = async (orderId: string) => ({
  orderId,
  status: orderId === 'order-1042' ? 'shipped' : 'not_found',
});

export const findOrderTool = {
  type: 'custom',
  name: 'find_order',
  description: 'Retrieves one order by its identifier.',
  input_schema: FindOrderInput,
  strict: true,
} as const;
```

### /src/instructions.ts

```typescript
import { readFileSync } from 'node:fs';

/** Reads the canonical support instruction. */
export const loadInstruction = (): string =>
  readFileSync(new URL('../moldea/agents/support/instruction.md', import.meta.url), 'utf8');
```

<!-- example:end -->

## What the check establishes

The integration check reads these exact file blocks, requires positive adapter evidence for the documented relationships, and rejects a broken runtime binding. It does not prove that instructions are followed, that every SDK version accepts these forms, or that the application is ready for production. Continue using the installed adapter diagnostics for your actual source.
