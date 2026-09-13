---
title: Binding example
description: Complete manifest and source files for inspecting langgraph bindings locally.
order: 5
---

# Binding example

Read this example before searching adapter implementation for binding syntax. It is a complete **static inspection** file set, not a deployment starter or a live provider test. The files are checked together through this adapter and Core without installing or executing the target SDK. Keep application setup, credentials, provider model access, tool execution, and deployment configuration separate.

## How the bindings connect

The Graph API binds the exported compiled graph and its `input`/`output` schema constants. The Functional API binds the exported `entrypoint` result. Tasks and graph edges are not model-visible tools or handoffs. This adapter does not establish instruction-loader evidence or Functional API schema evidence. The node and task below read canonical instructions, but that consumption must be reviewed independently; graph observations do not prove it.

Paths below are repository-root-relative logical paths. Keep the canonical instructions as the policy source. General manifest semantics belong to the [Repository Format specification](https://packages.moldea.ai/repository-format/). Use the other local guides for the full supported boundary and limitations; this example does not expand them.

## Files

<!-- example:start -->

### /moldea/moldea.yaml

```yaml
version: 1
agents:
  graph:
    runtime:
      id: 'langgraph'
    bindings:
      runtimeAgent:
        path: '/src/graph.ts'
        symbol: 'supportGraph'
      inputSchema:
        path: '/src/contracts.ts'
        symbol: 'GraphInputSchema'
      outputSchema:
        path: '/src/contracts.ts'
        symbol: 'GraphOutputSchema'
  functional:
    runtime:
      id: 'langgraph'
    bindings:
      runtimeAgent:
        path: '/src/functional.ts'
        symbol: 'supportWorkflow'
```

### /package.json

```json
{
  "dependencies": {
    "@langchain/core": "~1.2.9",
    "@langchain/langgraph": "~1.4.12",
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

### /moldea/agents/graph/description.md

```markdown
Runs a customer-support graph.
```

### /moldea/agents/graph/instruction.md

```markdown
You are the `graph` agent.

Answer from supplied support facts. Do not invent order status or account information.
```

### /moldea/agents/functional/description.md

```markdown
Runs a customer-support workflow.
```

### /moldea/agents/functional/instruction.md

```markdown
You are the `functional` agent.

Answer from supplied support facts. Do not invent order status or account information.
```

### /src/contracts.ts

```typescript
import { z } from 'zod';

// graph state and its public input/output contracts
export const GraphInputSchema = z.object({ request: z.string() });
export const GraphOutputSchema = z.object({ answer: z.string() });
export const GraphStateSchema = z.object({ request: z.string(), answer: z.string().optional() });
```

### /src/graph.ts

```typescript
import { readFileSync } from 'node:fs';
import { END, START, StateGraph } from '@langchain/langgraph';
import { GraphInputSchema, GraphOutputSchema, GraphStateSchema } from './contracts.js';

const respond = async ({ request }: { request: string }) => ({
  answer:
    readFileSync(new URL('../moldea/agents/graph/instruction.md', import.meta.url), 'utf8') +
    '\n' +
    request,
});
const builder = new StateGraph({
  state: GraphStateSchema,
  input: GraphInputSchema,
  output: GraphOutputSchema,
});
builder.addNode('respond', respond);
builder.addEdge(START, 'respond');
builder.addEdge('respond', END);

// this source-only example assembles prompt text without calling a model
export const supportGraph = builder.compile({ name: 'support_graph' });
```

### /src/functional.ts

```typescript
import { readFileSync } from 'node:fs';
import { entrypoint, task } from '@langchain/langgraph';

const prepare = task(
  'prepare_request',
  async (request: string) =>
    readFileSync(new URL('../moldea/agents/functional/instruction.md', import.meta.url), 'utf8') +
    '\n' +
    request,
);

// the returned text is a prepared prompt, not a model response
export const supportWorkflow = entrypoint({ name: 'support_workflow' }, async (request: string) => {
  return await prepare(request);
});
```

<!-- example:end -->

## What the check establishes

The integration check reads these exact file blocks, requires positive adapter evidence for the documented relationships, and rejects a broken runtime binding. It does not prove that instructions are followed, that every SDK version accepts these forms, or that the application is ready for production. Continue using the installed adapter diagnostics for your actual source.
