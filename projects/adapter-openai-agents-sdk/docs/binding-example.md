---
title: Binding example
description: Complete manifest and source files for inspecting openai-agents-sdk bindings locally.
order: 5
---

# Binding example

Read this example before searching adapter implementation for binding syntax. It is a complete **static inspection** file set, not a deployment starter or a live provider test. The files are checked together through this adapter and Core without installing or executing the target SDK. Keep application setup, credentials, provider model access, tool execution, and deployment configuration separate.

## How the bindings connect

Bind each exported `Agent` instance. `instructions` calls its canonical loader and `outputType` names the agent output schema. Tool implementation, registration, input, and output are separate bindings. A handoff links the registered target agent; its static routing description must match that target's `handoff-description.md`. Do not put a handoff into the manifest's ordinary `tools` map.

Paths below are repository-root-relative logical paths. Keep the canonical instructions as the policy source. General manifest semantics belong to the [Repository Format specification](https://packages.moldea.ai/repository-format/). Use the other local guides for the full supported boundary and limitations; this example does not expand them.

## Files

<!-- example:start -->

### /moldea/moldea.yaml

```yaml
version: 1
agents:
  billing:
    runtime:
      id: 'openai-agents-sdk'
    bindings:
      runtimeAgent:
        path: '/src/agents.ts'
        symbol: 'billingAgent'
      instructionLoader:
        path: '/src/instructions.ts'
        symbol: 'loadBillingInstruction'
  triage:
    runtime:
      id: 'openai-agents-sdk'
    bindings:
      runtimeAgent:
        path: '/src/agents.ts'
        symbol: 'triageAgent'
      instructionLoader:
        path: '/src/instructions.ts'
        symbol: 'loadTriageInstruction'
      outputSchema:
        path: '/src/contracts.ts'
        symbol: 'TriageOutputSchema'
    tools:
      find-order:
        name: 'find_order'
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
        outputSchema:
          path: '/src/contracts.ts'
          symbol: 'FindOrderOutputSchema'
```

### /moldea/project.md

```markdown
# OpenAI Agents SDK adapter fixture
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
    "@openai/agents": "^0.16.1",
    "zod": "4.6.4"
  },
  "name": "binding-example",
  "private": true,
  "type": "module"
}
```

### /src/agents.ts

```typescript
import { Agent, handoff } from '@openai/agents';

import { TriageOutputSchema } from './contracts.js';
import { loadTriageInstruction, loadBillingInstruction } from './instructions.js';
import { billingRoutingDescription } from './metadata.js';
import { findOrderTool } from './tools.js';

export const billingAgent = new Agent({
  name: 'billing',
  instructions: loadBillingInstruction(),
  handoffDescription: billingRoutingDescription,
});

const configuredBillingHandoff = handoff(billingAgent, {
  toolNameOverride: 'route_billing',
  toolDescriptionOverride: billingRoutingDescription,
});
const triageTools = [findOrderTool];
const triageHandoffs = [billingAgent, configuredBillingHandoff];

export const triageAgent = Agent.create({
  name: 'triage',
  instructions: loadTriageInstruction(),
  outputType: TriageOutputSchema,
  tools: triageTools,
  handoffs: triageHandoffs,
});
```

### /src/contracts.ts

```typescript
import { z } from 'zod';

// response and tool contracts
export const TriageOutputSchema = z.object({ summary: z.string() });
export const FindOrderInputSchema = z.object({ orderId: z.string() });
export const FindOrderOutputSchema = z.object({
  orderId: z.string(),
  status: z.enum(['shipped', 'not_found']),
});
```

### /src/find-order.ts

```typescript
/** Looks up an order in the example's fixed catalog. */
export const findOrder = async ({ orderId }: { orderId: string }) => ({
  orderId,
  status: orderId === 'order-1042' ? ('shipped' as const) : ('not_found' as const),
});
```

### /src/instructions.ts

```typescript
import { readFileSync } from 'node:fs';

/** Reads the canonical triage instruction. */
export const loadTriageInstruction = (): string =>
  readFileSync(new URL('../moldea/agents/triage/instruction.md', import.meta.url), 'utf8');

/** Reads the canonical billing instruction. */
export const loadBillingInstruction = (): string =>
  readFileSync(new URL('../moldea/agents/billing/instruction.md', import.meta.url), 'utf8');
```

### /src/metadata.ts

```typescript
export const billingRoutingDescription = 'Route billing questions and payment issues here.';
```

### /src/tools.ts

```typescript
import { tool } from '@openai/agents';

import { FindOrderInputSchema, FindOrderOutputSchema } from './contracts.js';
import { findOrder } from './find-order.js';

export const findOrderTool = tool({
  name: 'find_order',
  description: 'Retrieves one order by its identifier.',
  parameters: FindOrderInputSchema,
  outputSchema: FindOrderOutputSchema,
  execute: findOrder,
});
```

<!-- example:end -->

## What the check establishes

The integration check reads these exact file blocks, requires positive adapter evidence for the documented relationships, and rejects a broken runtime binding. It does not prove that instructions are followed, that every SDK version accepts these forms, or that the application is ready for production. Continue using the installed adapter diagnostics for your actual source.
