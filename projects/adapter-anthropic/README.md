# `@moldea.ai/adapter-anthropic`

Deterministic runtime evidence and diagnostics for direct Anthropic SDK integrations.

Version `4.0.2` supports this verified technical boundary:

- TypeScript ESM source in `.ts`, `.tsx`, and `.mts` files
- `@anthropic-ai/sdk >=0.117.1`
- `@moldea.ai/core ^4.0.0`
- Repository Format version `1`
- direct `client.messages.create(...)` calls
- instruction loaders wired through `system`
- closed client-tool arrays and direct `input_schema` bindings
- client-tool names matching `^[A-Za-z0-9_-]{1,64}$`

The adapter performs static inspection only. It does not import or execute the Anthropic SDK, send provider requests, validate model output, or interpret streaming behavior.

## Usage

```ts
import { createCore } from '@moldea.ai/core';
import { anthropicAdapter } from '@moldea.ai/adapter-anthropic';

const core = createCore({ adapters: [anthropicAdapter] });
```

## Documentation

- [Complete binding example](docs/binding-example.md): manifest, canonical instructions, runtime source, and supported schema or routing relationships.

These guides are included in the installed package. Open only the page relevant to your task.

- [Package overview](docs/index.md)
- [Verified target](docs/verified-target.md)
- [Evidence and diagnostics](docs/evidence-and-diagnostics.md)
- [Limitations](docs/limitations.md)

## Diagnostics

`ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` only when the adapter identifies a declared relationship affected by a recognized but unresolved source candidate. Its safe details identify the relationship and reason; known version-behavior boundaries additionally carry normalized dependency context. Missing local evidence or a newer eligible dependency version alone does not produce this warning. Confirmed diagnostic codes remain errors.

`ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED`: The declared runtime relationship could not be verified.
