# Runtime logo provenance and launch follow-ups

The website UI catalog uses 35 runtime labels. Vendor or project marks are shared across related labels to identify guidance destinations. They do not assert SDK support, compatibility, certification, endorsement, or a commercial relationship.

## Public-launch responsibility

Before public launch, the developer must resolve the agreed permission review for Anthropic, OpenAI, Google, and IBM, and check the restrictions published by AWS, Microsoft, and GitHub. Shipping an asset here does not establish permission. Permission requests and decisions remain the developer's responsibility. Preserve attribution, clear space, proportions, colors, and any conditions attached to permission. Do not mechanically recolor or invert a mark to create a dark variant.

The table links published usage guidance where located. References marked “project reference” identify the publisher, **not a logo usage grant**; separate brand terms were not located during this inspection. Review those terms before launch as well. Sources were inspected on 2026-10-11.

## Asset sources

Assets live in `projects/website-ui/runtime-logos/` and are exported as `@moldea.ai/website-ui/runtime-logos/<filename>`. Extraction removes executable or embedding constructs, presentation classes, metadata, and unused attributes; path geometry and explicit colors remain. The unit gate rejects unsupported elements, event handlers, styles, entities, and external references. View boxes are preserved, or derived from explicit source dimensions when absent. Source-provided dark variants are retained where identified. Single-variant marks receive a light backing for contrast.

| Asset                | Official source                                                                                                                                                      | Extraction                  | Usage guidance or project reference                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `amazon.svg`         | [Source](https://aws.amazon.com/bedrock/)                                                                                                                            | header SVG 1                | [Reference](https://aws.amazon.com/trademark-guidelines/)                                                             |
| `anthropic.svg`      | [Source](https://claude.com/)                                                                                                                                        | `AnthropicWordmark` element | [Reference](https://www.anthropic.com/legal/trademark-guidelines)                                                     |
| `cerebras.svg`       | [Source](https://www.cerebras.ai/)                                                                                                                                   | Header home-link SVG        | [Project reference](https://www.cerebras.ai/); separate usage guidelines not located                                  |
| `claude.svg`         | [Source](https://claude.com/)                                                                                                                                        | `ClaudeWordmark` element    | [Reference](https://www.anthropic.com/legal/trademark-guidelines)                                                     |
| `cloudflare.svg`     | [Source](https://www.cloudflare.com/)                                                                                                                                | header SVG 1                | [Reference](https://www.cloudflare.com/trademark/)                                                                    |
| `cohere.svg`         | [Source](https://cohere.com/logo.svg)                                                                                                                                | SVG file                    | [Reference](https://cohere.com/) (project reference; separate usage guidelines not located)                           |
| `convex-dark.svg`    | [Source](https://www.convex.dev/resources/logos.zip)                                                                                                                 | `Logos/SVG/logo-white.svg`  | [Brand guidelines](https://www.convex.dev/brand)                                                                      |
| `convex.svg`         | [Source](https://www.convex.dev/resources/logos.zip)                                                                                                                 | `Logos/SVG/logo-color.svg`  | [Brand guidelines](https://www.convex.dev/brand)                                                                      |
| `cursor.svg`         | [Source](https://cursor.com/marketing-static/favicon-light.svg)                                                                                                      | SVG file                    | [Reference](https://cursor.com/) (project reference; separate usage guidelines not located)                           |
| `eve.svg`            | [Source](https://eve.dev/)                                                                                                                                           | header SVG 2                | [Reference](https://eve.dev/) (project reference; separate usage guidelines not located)                              |
| `github.svg`         | [Source](https://github.githubassets.com/favicons/favicon.svg)                                                                                                       | SVG file                    | [Reference](https://brand.github.com/)                                                                                |
| `google.svg`         | [Source](https://www.gstatic.com/devrel-devsite/prod/v097103d8ccd7b257790809ea4cc5e5fee6daa6e24890a4af388296e58364bc31/googledevai/images/lockup-new.svg)            | SVG file                    | [Reference](https://about.google/brand-resource-center/guidance/)                                                     |
| `google-dark.svg`    | [Source](https://www.gstatic.com/devrel-devsite/prod/v097103d8ccd7b257790809ea4cc5e5fee6daa6e24890a4af388296e58364bc31/googledevai/images/lockup-dark-theme-new.svg) | SVG file                    | [Reference](https://about.google/brand-resource-center/guidance/)                                                     |
| `groq.svg`           | [Source](https://groq.com/favicon.svg)                                                                                                                               | SVG file                    | [Reference](https://groq.com/) (project reference; separate usage guidelines not located)                             |
| `hugging-face.svg`   | [Source](https://huggingface.co/front/assets/huggingface_logo-noborder.svg)                                                                                          | SVG file                    | [Reference](https://huggingface.co/brand)                                                                             |
| `ibm.svg`            | [Source](https://www.ibm.com/design/language/2285fa814297ab5eb0ffa21d2ee009db/ibm.svg)                                                                               | SVG file                    | [Reference](https://www.ibm.com/design/language/ibm-logos/8-bar/)                                                     |
| `langchain.svg`      | [Source](https://www.langchain.com/)                                                                                                                                 | header SVG 1                | [Reference](https://www.langchain.com/) (project reference; separate usage guidelines not located)                    |
| `livekit.svg`        | [Source](https://livekit.com/)                                                                                                                                       | header SVG 1                | [Reference](https://livekit.com/) (project reference; separate usage guidelines not located)                          |
| `mastra.svg`         | [Source](https://mastra.ai/favicon/new-brand/icon.svg)                                                                                                               | SVG file                    | [Reference](https://mastra.ai/) (project reference; separate usage guidelines not located)                            |
| `mistral.svg`        | [Source](https://mistral.ai/)                                                                                                                                        | header SVG 1                | [Reference](https://mistral.ai/) (project reference; separate usage guidelines not located)                           |
| `node-llama-cpp.svg` | [Source](https://node-llama-cpp.withcat.ai/icon.svg)                                                                                                                 | SVG file                    | [Reference](https://github.com/withcatai/node-llama-cpp) (project reference; separate usage guidelines not located)   |
| `ollama.svg`         | [Source](https://raw.githubusercontent.com/ollama/ollama/main/docs/ollama-logo.svg)                                                                                  | SVG file                    | [Reference](https://github.com/ollama/ollama) (project reference; separate usage guidelines not located)              |
| `ollama-dark.svg`    | [Source](https://raw.githubusercontent.com/ollama/ollama/main/docs/favicon.svg)                                                                                      | SVG file                    | [Reference](https://github.com/ollama/ollama) (project reference; separate usage guidelines not located)              |
| `openai.svg`         | [Source](https://raw.githubusercontent.com/openai/openai-agents-js/main/docs/src/assets/light-logo.svg)                                                              | SVG file                    | [Reference](https://openai.com/brand/)                                                                                |
| `openai-dark.svg`    | [Source](https://raw.githubusercontent.com/openai/openai-agents-js/main/docs/src/assets/dark-logo.svg)                                                               | SVG file                    | [Reference](https://openai.com/brand/)                                                                                |
| `opencode.svg`       | [Source](https://opencode.ai/)                                                                                                                                       | `logo light` element        | [Reference](https://opencode.ai/) (project reference; separate usage guidelines not located)                          |
| `opencode-dark.svg`  | [Source](https://opencode.ai/)                                                                                                                                       | `logo dark` element         | [Reference](https://opencode.ai/) (project reference; separate usage guidelines not located)                          |
| `pi.svg`             | [Source](https://pi.dev/logo-auto.svg)                                                                                                                               | SVG file                    | [Reference](https://github.com/earendil-works/pi) (project reference; separate usage guidelines not located)          |
| `strands.svg`        | [Source](https://raw.githubusercontent.com/strands-agents/harness-sdk/main/site/src/assets/logo-light.svg)                                                           | SVG file                    | [Reference](https://github.com/strands-agents/harness-sdk) (project reference; separate usage guidelines not located) |
| `strands-dark.svg`   | [Source](https://raw.githubusercontent.com/strands-agents/harness-sdk/main/site/src/assets/logo-dark.svg)                                                            | SVG file                    | [Reference](https://github.com/strands-agents/harness-sdk) (project reference; separate usage guidelines not located) |
| `tanstack.svg`       | [Source](https://tanstack.com/images/brand/tanstack-landscape-black.svg)                                                                                             | SVG file                    | [Reference](https://tanstack.com/brand)                                                                               |
| `tanstack-dark.svg`  | [Source](https://tanstack.com/images/brand/tanstack-landscape-white.svg)                                                                                             | SVG file                    | [Reference](https://tanstack.com/brand)                                                                               |
| `vercel.svg`         | [Source](https://ai-sdk.dev/icon.svg?icon.44kufuj_v435m.svg)                                                                                                         | SVG file                    | [Reference](https://vercel.com/geist/brands)                                                                          |
| `voltagent.svg`      | [Source](https://voltagent.dev/)                                                                                                                                     | Header logo-link SVG        | [Project reference](https://github.com/VoltAgent/voltagent); separate usage guidelines not located                    |
| `fallback.svg`       | Authored here; neutral document glyph                                                                                                                                | No vendor mark              | Package MIT license                                                                                                   |

Genkit uses the fallback because [its official site](https://genkit.dev/) exposes its header mark as WebP; no official SVG source was located. Microsoft Foundry uses the fallback because the [Microsoft site](https://www.microsoft.com/) rejected asset inspection (HTTP 403); [Microsoft trademark guidance](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks) applies to any future mark. OpenRouter uses the fallback because its official [light](https://openrouter.ai/brand/v2/openrouter-light.svg) and [dark](https://openrouter.ai/brand/v2/openrouter-dark.svg) SVG requests returned HTTP 403. Revisit these official sources before replacing the fallback; do not substitute an unverified third-party icon.

## Runtime mapping

This is a label inventory, not a compatibility matrix. `custom` is intentionally absent. Dark variants use the same basename with `-dark` where listed above, except Strands: its dark-ink file is used in the light theme and its gray-ink file in the dark theme.

| Runtime ID           | Asset family         |
| -------------------- | -------------------- |
| `amazon-bedrock`     | `amazon.svg`         |
| `anthropic`          | `anthropic.svg`      |
| `cerebras`           | `cerebras.svg`       |
| `claude-agent-sdk`   | `claude.svg`         |
| `cloudflare-agents`  | `cloudflare.svg`     |
| `cohere`             | `cohere.svg`         |
| `convex-agent`       | `convex.svg`         |
| `cursor-sdk`         | `cursor.svg`         |
| `deep-agents`        | `langchain.svg`      |
| `eve`                | `eve.svg`            |
| `genkit`             | `fallback.svg`       |
| `github-copilot-sdk` | `github.svg`         |
| `google-adk`         | `google.svg`         |
| `google-genai`       | `google.svg`         |
| `groq`               | `groq.svg`           |
| `hugging-face`       | `hugging-face.svg`   |
| `ibm-watsonx-ai`     | `ibm.svg`            |
| `langchain`          | `langchain.svg`      |
| `langgraph`          | `langchain.svg`      |
| `livekit-agents`     | `livekit.svg`        |
| `mastra`             | `mastra.svg`         |
| `microsoft-foundry`  | `fallback.svg`       |
| `mistral`            | `mistral.svg`        |
| `node-llama-cpp`     | `node-llama-cpp.svg` |
| `ollama`             | `ollama.svg`         |
| `openai`             | `openai.svg`         |
| `openai-agents-sdk`  | `openai.svg`         |
| `openai-codex`       | `openai.svg`         |
| `opencode-sdk`       | `opencode.svg`       |
| `openrouter`         | `fallback.svg`       |
| `pi-agent`           | `pi.svg`             |
| `strands-agents`     | `strands-dark.svg`   |
| `tanstack-ai`        | `tanstack.svg`       |
| `vercel-ai-sdk`      | `vercel.svg`         |
| `voltagent`          | `voltagent.svg`      |
