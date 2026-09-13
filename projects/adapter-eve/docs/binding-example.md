---
title: Binding example
description: Complete manifest and source files for inspecting eve bindings locally.
order: 5
---

# Binding example

Read this example before searching adapter implementation for binding syntax. It is a complete **static inspection** file set, not a deployment starter or a live provider test. The files are checked together through this adapter and Core without installing or executing the target SDK. Keep application setup, credentials, provider model access, tool execution, and deployment configuration separate.

## How the bindings connect

Use `symbol: default` for directly default-exported Eve agents and tools. The `instructionLoader` points to the exact `instructions.md` path without a symbol; `mirrors` makes that file an exact copy of the owner's canonical instruction. `outputSchema` binds the exported schema used by `defineAgent`. A subagent's static `description` must match its canonical `handoff-description.md` (or canonical description when no handoff description exists). Register the child agent itself, not a synthetic handoff tool. Do not attach package or compiler files to every agent mechanically.

Paths below are repository-root-relative logical paths. Keep the canonical instructions as the policy source. General manifest semantics belong to the [Repository Format specification](https://packages.moldea.ai/repository-format/). Use the other local guides for the full supported boundary and limitations; this example does not expand them.

## Files

<!-- example:start -->

### /moldea/moldea.yaml

```yaml
version: 1
agents:
  support:
    runtime:
      id: 'eve'
    bindings:
      runtimeAgent:
        path: '/agent/agent.ts'
        symbol: 'default'
      instructionLoader:
        path: '/agent/instructions.md'
      outputSchema:
        path: '/agent/contracts.ts'
        symbol: 'SupportOutputSchema'
    tools:
      search:
        name: 'search'
        description: 'Searches the knowledge base.'
        implementation:
          path: '/agent/implementations.ts'
          symbol: 'searchKnowledge'
        registration:
          path: '/agent/tools/search.ts'
          symbol: 'default'
        inputSchema:
          path: '/agent/contracts.ts'
          symbol: 'SearchInputSchema'
        outputSchema:
          path: '/agent/contracts.ts'
          symbol: 'SearchOutputSchema'
    mirrors:
      - '/agent/instructions.md'
  summary:
    runtime:
      id: 'eve'
    bindings:
      runtimeAgent:
        path: '/agent/subagents/summary/agent.ts'
        symbol: 'default'
      instructionLoader:
        path: '/agent/subagents/summary/instructions.md'
    mirrors:
      - '/agent/subagents/summary/instructions.md'
```

### /package.json

```json
{
  "name": "binding-example",
  "dependencies": {
    "eve": "^0.39.1",
    "zod": "4.6.4"
  },
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
Summarizes support requests.
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

### /agent/agent.ts

```typescript
import { defineAgent } from 'eve';
import { SupportOutputSchema } from './contracts.js';

export default defineAgent({ model: 'openai/gpt-5', outputSchema: SupportOutputSchema });
```

### /agent/contracts.ts

```typescript
import { z } from 'zod';

// response and tool contracts
export const SupportOutputSchema = z.object({ answer: z.string() });
export const SearchInputSchema = z.object({ query: z.string() });
export const SearchOutputSchema = z.object({ matches: z.array(z.string()) });
```

### /agent/implementations.ts

```typescript
/** Searches this example's small local knowledge base. */
export const searchKnowledge = async ({ query }: { query: string }) => ({
  matches: ['Returns are accepted within 30 days.'].filter((entry) =>
    entry.toLowerCase().includes(query.toLowerCase()),
  ),
});
```

### /agent/tools/search.ts

```typescript
import { defineTool } from 'eve/tools';
import { SearchInputSchema, SearchOutputSchema } from '../contracts.js';
import { searchKnowledge } from '../implementations.js';
export default defineTool({
  description: 'Searches the knowledge base.',
  inputSchema: SearchInputSchema,
  outputSchema: SearchOutputSchema,
  execute: searchKnowledge,
});
```

### /agent/subagents/summary/agent.ts

```typescript
import { defineAgent } from 'eve';

export default defineAgent({
  description: 'Summarizes a support request.',
  model: 'openai/gpt-5',
});
```

### /agent/instructions.md

```markdown
You are the `support` agent.

Answer from supplied support facts. Do not invent order status or account information.
```

### /agent/subagents/summary/instructions.md

```markdown
You are the `summary` agent.

Summarize the supplied support request without inventing facts.
```

<!-- example:end -->

## What the check establishes

The integration check reads these exact file blocks, requires positive adapter evidence for the documented relationships, and rejects a broken runtime binding. It does not prove that instructions are followed, that every SDK version accepts these forms, or that the application is ready for production. Continue using the installed adapter diagnostics for your actual source.
