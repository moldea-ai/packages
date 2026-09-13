---
title: Binding example
description: Complete manifest and source files for inspecting claude-agent-sdk bindings locally.
order: 5
---

# Binding example

Read this example before searching adapter implementation for binding syntax. It is a complete **static inspection** file set, not a deployment starter or a live provider test. The files are checked together through this adapter and Core without installing or executing the target SDK. Keep application setup, credentials, provider model access, tool execution, and deployment configuration separate.

## How the bindings connect

Bind the query function and each exported programmatic subagent object separately. Query `systemPrompt` and child `prompt` call their canonical loaders. Query `outputFormat.schema` binds the JSON Schema constant. `tools: ['Agent']` enables delegation; child `description` matches its canonical handoff description. MCP tool names use the query server key (`mcp__support__find_order`), not the server's display name. `tool` takes a Zod property map, whereas `outputFormat` takes JSON Schema. This target does not establish tool output-schema evidence.

Paths below are repository-root-relative logical paths. Keep the canonical instructions as the policy source. General manifest semantics belong to the [Repository Format specification](https://packages.moldea.ai/repository-format/). Use the other local guides for the full supported boundary and limitations; this example does not expand them.

## Files

<!-- example:start -->

### /moldea/moldea.yaml

```yaml
version: 1
agents:
  billing:
    runtime:
      id: 'claude-agent-sdk'
    bindings:
      runtimeAgent:
        path: '/src/agents.ts'
        symbol: 'billingAgent'
      instructionLoader:
        path: '/src/instructions.ts'
        symbol: 'loadBillingInstruction'
    tools:
      find-order:
        name: 'mcp__support__find_order'
        description: 'Retrieves one order by its identifier.'
        implementation:
          path: '/src/find-order.ts'
          symbol: 'findOrder'
        registration:
          path: '/src/tools.ts'
          symbol: 'findOrderTool'
        inputSchema:
          path: '/src/contracts.ts'
          symbol: 'FindOrderInputSchema'
  triage:
    runtime:
      id: 'claude-agent-sdk'
    bindings:
      runtimeAgent:
        path: '/src/runtime.ts'
        symbol: 'triageAgent'
      instructionLoader:
        path: '/src/instructions.ts'
        symbol: 'loadTriageInstruction'
      outputSchema:
        path: '/src/contracts.ts'
        symbol: 'TriageOutputSchema'
    tools:
      find-order:
        name: 'mcp__support__find_order'
        description: 'Retrieves one order by its identifier.'
        implementation:
          path: '/src/find-order.ts'
          symbol: 'findOrder'
        registration:
          path: '/src/tools.ts'
          symbol: 'findOrderTool'
        inputSchema:
          path: '/src/contracts.ts'
          symbol: 'FindOrderInputSchema'
```

### /moldea/project.md

```markdown
# Claude Agent SDK adapter fixture
```

### /moldea/agents/billing/description.md

```markdown
Handles customer billing requests.
```

### /moldea/agents/billing/handoff-description.md

```markdown
Route billing questions and payment issues here.
```

### /moldea/agents/billing/instruction.md

```markdown
You are the `billing` agent.

Resolve billing requests from the supplied facts. Ask when essential details are missing.
```

### /moldea/agents/triage/description.md

```markdown
Routes customer support requests.
```

### /moldea/agents/triage/instruction.md

```markdown
You are the `triage` agent.

Route billing requests to billing. Do not invent account facts.
```

### /package.json

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.3.234",
    "zod": "4.6.4"
  },
  "name": "binding-example",
  "private": true,
  "type": "module"
}
```

### /src/agents.ts

```typescript
import { loadBillingInstruction } from './instructions.js';

export const billingAgent = {
  description: 'Route billing questions and payment issues here.',
  prompt: loadBillingInstruction(),
  tools: ['mcp__support__find_order'],
};
```

### /src/contracts.ts

```typescript
import { z } from 'zod';

// response and tool contracts
export const TriageOutputSchema = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
  additionalProperties: false,
} as const;
export const FindOrderInputSchema = { orderId: z.string() };
```

### /src/find-order.ts

```typescript
/** Returns one sample order as MCP text content. */
export const findOrder = async ({ orderId }: { orderId: string }) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify({ orderId, status: orderId === 'order-1042' ? 'shipped' : 'not_found' }),
    },
  ],
});
```

### /src/instructions.ts

```typescript
import { readFileSync } from 'node:fs';

/** Reads the canonical billing instruction. */
export const loadBillingInstruction = (): string =>
  readFileSync(new URL('../moldea/agents/billing/instruction.md', import.meta.url), 'utf8');

/** Reads the canonical triage instruction. */
export const loadTriageInstruction = (): string =>
  readFileSync(new URL('../moldea/agents/triage/instruction.md', import.meta.url), 'utf8');
```

### /src/runtime.ts

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

import { billingAgent } from './agents.js';
import { TriageOutputSchema } from './contracts.js';
import { loadTriageInstruction } from './instructions.js';
import { supportServer } from './tools.js';

export const triageAgent = async (prompt: string) =>
  query({
    prompt,
    options: {
      systemPrompt: await loadTriageInstruction(),
      outputFormat: { type: 'json_schema', schema: TriageOutputSchema },
      agents: { billing: billingAgent },
      tools: ['Agent'],
      mcpServers: { support: supportServer },
    },
  });
```

### /src/tools.ts

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

import { FindOrderInputSchema } from './contracts.js';
import { findOrder } from './find-order.js';

export const findOrderTool = tool(
  'find_order',
  'Retrieves one order by its identifier.',
  FindOrderInputSchema,
  findOrder,
);

export const supportServer = createSdkMcpServer({
  name: 'support-tools',
  version: '1.0.0',
  tools: [findOrderTool],
});
```

<!-- example:end -->

## What the check establishes

The integration check reads these exact file blocks, requires positive adapter evidence for the documented relationships, and rejects a broken runtime binding. It does not prove that instructions are followed, that every SDK version accepts these forms, or that the application is ready for production. Continue using the installed adapter diagnostics for your actual source.
