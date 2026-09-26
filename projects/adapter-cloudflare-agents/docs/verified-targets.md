---
title: Verified targets
description: Exact Cloudflare package ranges and statically supported integration patterns.
order: 10
---

# Verified targets

## Think 0.16 with AI SDK 7

The `typescript-think-0-16-ai-sdk-7` target requires `@cloudflare/think >=0.16.0`, `agents >=0.21.0`, and `ai >=7.0.0`.

The runtime agent must be a directly exported class extending an exact named `Think` import. Instructions may come from a direct loader call returned by `getSystemPrompt`, a closed `configureSession().withContext(...)` chain, or a closed inline custom `withCachedPrompt(provider)` getter with an inert setter. Think 0.18.0 and newer also use closed `configureContext()` blocks. The two context sources merge in order, with later session blocks replacing earlier blocks of the same label. Configured blocks can suppress the `getSystemPrompt` fallback at runtime without erasing its independent configured-source evidence. `withCachedPrompt()` without a custom provider does not establish an instruction loader.

The adapter keeps the minimum-only eligible range. When a declaration spans 0.18.0 and the instruction conclusion differs across the boundary, it emits a scoped warning instead of claiming verified wiring or a confirmed defect. Function tools and handoffs must be active in a closed `getTools` map. This target emits no `runtime-pattern` evidence and supports no agent input or output schema binding.

## AIChatAgent 0.10 with AI SDK 7

The `typescript-ai-chat-agent-0-10-ai-sdk-7` target requires `@cloudflare/ai-chat >=0.10.2`, `agents >=0.21.0`, and `ai >=7.0.0`.

The runtime agent must be a directly exported class extending an exact named `AIChatAgent` import. Its supported `onChatMessage(onFinish, options?)` method contains direct `generateText({ ... })` or `streamText({ ... })` calls in its own lexical body. `instructions` takes precedence over `system`; `prepareStep` makes instructions unresolved. Agent output schemas use `Output.object({ schema })`.

Both targets require closed class initialization, named ESM imports, normalized `.ts`, `.tsx`, or `.mts` text, and exact relative ESM binding resolution.

Function-tool registration evidence records the `deferLoading` source option when present. The option is accepted by newer AI SDK 7 releases; the older eligible floor does not itself prove the option is supported. The evidence does not claim that a deferred tool is available on a particular model turn.
