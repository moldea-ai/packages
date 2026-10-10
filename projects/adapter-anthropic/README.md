# `@moldea.ai/adapter-anthropic`

Deterministic runtime evidence and diagnostics for direct Anthropic SDK integrations.

Version `6.0.0` supports this verified technical boundary:

- TypeScript ESM source in `.ts`, `.tsx`, and `.mts` files
- `@anthropic-ai/sdk >=0.117.1`
- `@moldea.ai/core ^6.0.0`
- Repository Format version `1`
- direct `client.messages.create(...)`, `parse(...)`, and `stream(...)` calls
- effective second-argument `body` overrides; transport-only options leave request wiring unchanged
- instruction loaders wired through `system`
- agent output schemas wired through `output_config.format` as direct JSON Schema or a direct `zodOutputFormat` argument
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

`ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` when an applicable declared relationship remains unverified, including unsupported source patterns, dynamic or mutated wiring, and ranges spanning a relevant behavior change. Its safe details identify the relationship and reason; version-dependent warnings also include normalized dependency context. Independent export checks and proved contradictions remain errors. Warning-only validation is valid with `runtimeInspection: 'incomplete'`; it does not establish launch readiness. A newer eligible dependency version alone does not produce this warning.

`ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED`: The declared runtime relationship could not be verified.
