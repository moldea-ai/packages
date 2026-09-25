# Package launch readiness and adapter evolution

## Objective and task contract

Prepare all fifteen public packages and the packages website for launch, so the next skill version can consume accurate, stable, resource-bounded package contracts.

This plan incorporates the reviewed agent conversation, repository investigation, upstream research, plan challenge, specification reinspection, and the developer's subsequent decisions. It is planning only. Implementation approval will cover the package work and the explicitly listed documentation-only changes in the sibling `platform` repository. Publication, deployment, commits, platform application changes, and the next skill implementation remain outside that approval.

### Agreed requirements

- Update the existing ten adapter families for the concrete capabilities and corrections below. Preserve support for their existing eligible older SDK implementations.
- Preserve independent package versioning, compatible-major Moldea dependencies, and the current minimum-only upstream SDK eligibility ranges. A new upstream release, by itself, must not invalidate an installation or produce a warning.
- Introduce native diagnostic severity: errors fail completed validation; warnings communicate a specific unverified relationship without failing validation. Operational failures remain failures.
- Use one authoritative implementation. Remove superseded Moldea paths as they are replaced; retain older SDK source patterns because they remain supported product behavior.
- Keep the architecture simple. Extend existing owners and shared primitives; avoid a runtime compatibility engine, repository execution, global agent enumeration, or a new Core orchestration model.
- Measure complete workflows, cumulative output, and repeated work. Keep content, memory, I/O, diagnostics, evidence, and execution bounded.
- Update the website, technical documentation, executable capability catalog, and selected public examples alongside the packages.
- Synchronize the affected platform-owned specifications with their implementation. Preserve the recent specification-ownership clarification and unrelated edits.
- Website UI does not require a new focused specification. Its existing README, package documentation, declarations, tests, and packed artifact remain sufficient for this launch audit.
- Finish with evidence for every public package. Passing isolated tests or changing a dependency declaration does not establish production readiness.

### Exclusions

- Hosted OpenAI Agents API integration, additional adapter families, and implementation of the next skill.
- Provider execution, model calls, SDK-managed storage migrations, remote credentials, or tests against paid provider accounts.
- Platform application changes, skill qualification execution, npm publication, tags, merges, and website deployment.
- Arbitrary import-graph interpretation, executing client repositories, dynamic runtime discovery, or claims that every future SDK release has been verified.
- Persistent inspection caches, background services, and broad unrelated modernization.
- Editing protected coding-instruction files.
- Creating `platform/moldea/context/website-ui-package.md` or making unrelated platform documentation changes.

## Inspected baseline and evidence

The packages repository remains at commit `dca170b4a21f21df5cdcbbdb25ae0971ed3c0bd8`, with no tracked changes and only this untracked planning directory. No implementation has begun. The root README, blueprint, development and release guides, affected contracts, adapter implementations, CLI projections, website generators, package manifests, test configuration, and release-selection code ground this plan.

The specification reinspection used the clean sibling `platform` worktree at commit `554f2d27cebab0b24809fb4fd723b28a2165a3e0`. Its recent ownership edits establish platform ownership of specifications; Core 4, CLI schema 4, failure-only adapter diagnostics, and the older adapter patterns still describe the existing contract. The revised implementation scope includes their synchronization, with the explicit Website UI exception above. The earlier plan challenge is superseded by this revision.

Development uses Node.js 24.15.0, pnpm 11.9.0, TypeScript 6.0.3, Vitest 4.1.10, Vite 8.2.1, and semver 7.8.5. The website uses Astro 7.2.2, Tailwind CSS 4.3.3, Zod 4.3.6, and Playwright 1.62.1. These tooling versions are not upgrade targets.

### Current architecture

- `projects/repository` owns source-neutral paths, snapshots, bounded reader contracts, and the memory reader.
- `projects/repository-fs` owns bounded, no-follow filesystem access.
- `projects/core` owns canonical validation, resource accounting, per-agent adapter invocation, exact same-runtime agent resolution, and prepared inspection pages.
- `packages/adapter-static-analysis` owns private parsing and inspection primitives bundled into public adapters.
- Each `projects/adapter-*` package owns SDK semantics, supported source forms, evidence, and diagnostic definitions.
- `projects/cli` owns installed composition, Git snapshots, commands, bounded serialization, exit status, and JSON schema 4.
- `projects/website-ui` owns shared Astro components and presentation primitives.
- `apps/website` generates documentation and executable examples from package contracts; it is not a sixteenth public package.

### Findings established during the investigation

| Finding                                                  | Evidence and consequence                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every adapter diagnostic fails validation                | `projects/core/src/project-validation/index.ts` derives validity from diagnostic count. CLI invariants and website capability validators repeat that assumption.         |
| Evidence cannot carry visible warnings alone             | CLI `validate` omits evidence; `presentation/transformers.ts` strips arbitrary evidence details from `inspect`.                                                          |
| Request analysis loses relevant call information         | Shared `types.ts` and `typescript-analysis/requests.ts` support one method name and return first-argument relationships without provider-specific option interpretation. |
| Anthropic request options can invalidate reported wiring | End-to-end source probes showed incorrect positive and negative instruction conclusions when the second argument supplies an overriding body.                            |
| Think has a known semantic boundary                      | The adapter counts `withCachedPrompt` as an instruction source, although Think 0.18.0 makes it a no-op.                                                                  |
| Eve needs discovery and registration corrections         | Existing probes included test files as tools and omitted the second edge in a three-agent nesting chain. Framework defaults are fixed to older semantics.                |
| Additive SDK capabilities are missed                     | Google streaming, Claude's `/core` entry point, AI SDK `deferLoading`, and LangGraph's two-argument `interrupt` need deliberate handling.                                |
| Bundled private changes can escape release selection     | `scripts/npm-release/project-changes.ts` and `git.ts` select by public project directory; adapter builds bundle private static-analysis code.                            |
| Small pages can still require repeated work              | The CLI constructs a fresh Core inspection for each invocation before returning a page. Source caches are local to adapter invocations.                                  |
| Website consumers need coordinated updates               | Capability validators, CLI schemas, reviewed expected results, and outcome presentation assume the existing diagnostic and JSON contracts.                               |

The earlier investigation ran the private static-analysis unit suite successfully: 82 tests in 12 files. It also used in-memory source probes for the concrete findings above. The complete package, browser, packed-consumer, and cross-platform suites have not been run for this proposed implementation. Planning does not certify readiness.

### Upstream reference snapshot

The npm latest versions were rechecked on 2026-09-25. They are test baselines, not runtime ceilings.

| Adapter family    | Retained minimum eligibility                                 | Reviewed current baseline                              |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| Anthropic         | `@anthropic-ai/sdk >=0.117.1`                                | 0.128.0                                                |
| Claude Agent SDK  | `>=0.3.234`                                                  | 0.3.282                                                |
| Cloudflare Agents | Think >=0.16.0; AIChat >=0.10.2; agents >=0.21.0; ai >=7.0.0 | Think 0.19.0; AIChat 0.12.0; agents 0.24.0; ai 7.0.114 |
| Eve               | `>=0.39.1`                                                   | 0.66.3                                                 |
| Google Gen AI     | `>=2.17.1`                                                   | 2.24.0                                                 |
| LangChain         | langchain >=1.5.9; core >=1.2.8                              | 1.5.12; core 1.2.12                                    |
| LangGraph         | langgraph >=1.4.12; core >=1.2.9                             | 1.4.18; core 1.2.12                                    |
| OpenAI            | `openai >=7.4.0`                                             | 7.23.0                                                 |
| OpenAI Agents SDK | `>=0.16.1`                                                   | 0.18.0                                                 |
| Vercel AI SDK     | `ai >=7.0.66`                                                | 7.0.114                                                |

Relevant primary references include [Anthropic Messages source](https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/sdk-v0.128.0/src/resources/messages/messages.ts), [OpenAI Responses source](https://raw.githubusercontent.com/openai/openai-node/v7.23.0/src/resources/responses/responses.ts), [Google Models reference](https://googleapis.github.io/js-genai/release_docs/classes/models.Models.html), and the provider-specific sources cited with the work below. Capture immutable package versions and source references in test provenance; moving upstream documentation is not a reproducible test input.

## Final diagnostic and validation contract

### Ownership and shape

Extend the existing diagnostic model rather than adding a parallel notices collection.

- Add required `severity` with values `error` and `warning`.
- Core structural diagnostics have literal severity `error`. Existing canonical parsers keep their all-or-nothing behavior.
- Adapter diagnostic catalogs own each code's stable message and severity together. Call sites cannot override severity.
- Existing confirmed-failure codes retain their failure meaning. Do not downgrade an existing code merely to make a fixture pass.
- Keep adapter output exactly `{ evidence, diagnostics }`. Core validates severity along with existing source, identity, location, scope, and content-safety rules.
- Missing or invalid severity is malformed adapter output and retains the existing `ADAPTER_EXECUTION_FAILED` contract. There is no fallback for old adapter result shapes.

Use one new warning contract per adapter for genuinely unverified declared relationships:

| Adapter           | Warning code                                        |
| ----------------- | --------------------------------------------------- |
| Anthropic         | `ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED`         |
| Claude Agent SDK  | `CLAUDE_AGENT_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED`  |
| Cloudflare Agents | `CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED` |
| Eve               | `EVE_RUNTIME_RELATIONSHIP_UNVERIFIED`               |
| Google Gen AI     | `GOOGLE_GENAI_RUNTIME_RELATIONSHIP_UNVERIFIED`      |
| LangChain         | `LANGCHAIN_RUNTIME_RELATIONSHIP_UNVERIFIED`         |
| LangGraph         | `LANGGRAPH_RUNTIME_RELATIONSHIP_UNVERIFIED`         |
| OpenAI            | `OPENAI_RUNTIME_RELATIONSHIP_UNVERIFIED`            |
| OpenAI Agents SDK | `OPENAI_AGENTS_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED` |
| Vercel AI SDK     | `VERCEL_AI_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED`     |

The stable message is: `The declared runtime relationship could not be verified.`

### Shared warning payload

Core owns `IUnverifiedRelationship`, `IUnverifiedRelationshipDetails`, `IAdapterErrorDiagnostic`, and `IAdapterWarningDiagnostic` in its diagnostic contract. `IAdapterDiagnostic` becomes their severity-discriminated union; retain the existing diagnostic envelope and scalar-only `details` field. Export the shared types through both the root and adapter public boundaries. Adapter catalogs retain ownership of their codes, messages, and SDK-specific decisions.

The relationship discriminator has these exact values and subjects:

| Relationship                                                                          | Required subject                                                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `runtime-agent`, `instruction-loader`, `agent-input-schema`, `agent-output-schema`    | An allowed agent and the corresponding existing manifest binding                                           |
| `tool-implementation`, `tool-registration`, `tool-input-schema`, `tool-output-schema` | An allowed agent and its declared tool; schema relationships also require the corresponding schema binding |
| `skill-implementation`, `skill-registration`                                          | An allowed agent and its declared skill                                                                    |
| `handoff-registration`, `routing-description`                                         | An allowed agent participating in the specifically inspected runtime-native relationship                   |
| `variable-provider`                                                                   | An allowed agent, declared variable, and corresponding provider binding                                    |

Reuse `entity.agentId`, `capabilityKind`, `capabilityId`, and `variableId` for those identities. Do not duplicate identities inside `details`. A registration may be conventional when the existing adapter supports that convention; no new manifest registration is required. Routing descriptions use the target agent as the subject and the inspected registration's source location. A handoff warning uses the invoking agent as its subject. These warnings never create a manifest handoff graph or authorize access to an unresolved target.

`IUnverifiedRelationshipDetails` is exactly one of these closed objects:

```typescript
type IUnverifiedRelationshipDetails =
  | {
      relationship: IUnverifiedRelationship;
      reason: 'unsupported-source-pattern' | 'dynamic-source-pattern';
    }
  | {
      relationship: IUnverifiedRelationship;
      reason: 'version-dependent-behavior';
      packageName: string;
      declaredRange: string | null;
      boundaryVersion: string;
    };
```

For version-dependent findings, `packageName` is the relevant upstream package identifier and `boundaryVersion` is the stable release at which the documented behavior changes. `declaredRange` is the node-semver-normalized union of the observed declarations considered by that adapter. It describes possible declared versions, never an installed version. Use `null` when those declarations cannot be safely normalized; never echo a raw tag, Git URL, filesystem reference, or other non-SemVer declaration. One warning identifies one relationship, source location, package, and behavior boundary. Multiple declarations do not require duplicate warnings.

Core validates the warning before retention: exact reason-specific keys, required subject and allowed relationship combination, a non-null repository-logical source path, existing range/pointer rules, and safe metadata. Package names use the scoped/unscoped lowercase npm identifier shape without URL or path forms. Boundary versions contain canonical numeric major/minor/patch components. Non-null declared ranges contain only normalized numeric comparator sets, optional SemVer prerelease/build identifier tokens, `*`, spaces, and `||` separators. Core checks this wire syntax without solving ranges or deciding SDK semantics; existing adapter-side node-semver logic owns normalization and behavioral classification. No new Core SemVer dependency or parallel range solver is needed.

At launch, the listed unverified-relationship codes are the only warning contracts. Core derives the reserved code from the adapter's existing namespace, verifies its stable message, and requires warning severity and the payload above. That code cannot be emitted as an error, and an existing failure code cannot be emitted as a warning. Unknown warning codes, missing or extra fields, invalid identities, malformed compatibility metadata, getters, and unsafe values retain `ADAPTER_EXECUTION_FAILED`. Error diagnostics preserve their existing scalar detail contract. Further warning kinds require an explicit contract extension rather than silently accepting arbitrary warning payloads.

All SDK-specific interpretation remains in adapters. Core has no provider release table, import recognizer, or provider-specific branch. Its existing adapter-validation module owns the shared boundary validation, using the current closed-object validation conventions. Payload sizes remain subject to existing operation, retained-memory, and output budgets; no truncation or source-body fallback is introduced.

Emit these warnings only for an attempted declared relationship whose conclusion is affected. Do not inventory every unsupported SDK feature, warn about unrelated syntax, or warn merely because a dependency is newer than the test baseline. A missing positive observation is not automatically a warning or an error.

These are inspection findings. They do not create or modify the repository format's persisted unresolved requirements.

### Validity, counts, and output

- Completed project validation is valid when universal validation succeeds and there are zero error diagnostics.
- Add `errorCount` and `warningCount` to complete project-validation results and CLI validation metadata.
- Extend prepared inspection counts with `errors` and `warnings`; preserve `diagnostics` as their total.
- Counts describe the complete result before pagination and appear on every output page.
- Derive counts and validity through one Core-owned calculation; consumers validate consistency instead of reinterpreting diagnostic count.
- Warnings-only results use CLI status `valid` and exit 0. Errors use `invalid` and exit 1. Existing operational statuses and exit codes remain unchanged.
- Human output states that validation passed with warnings and names the unresolved relationship. Both `validate` and `inspect` expose the warning count.
- JSON diagnostic records preserve severity. A warning record includes exactly the validated `details` object above; an error record omits `details`. The CLI projects those fields explicitly and never copies an arbitrary detail map. Human output renders the relationship and reason, plus package, normalized declaration when available, and boundary for version-dependent findings. Website schemas consume the same discriminated shape. No source excerpts, SDK option values, or arbitrary diagnostic details enter the output.
- Preserve deterministic identity, deduplication, digesting, and ordering. Include severity and relevant warning context in identity so distinct findings cannot collapse.
- Raw warning production consumes the existing diagnostic budget before deduplication. Exceeding a limit remains an explicit failure; no silent truncation.
- An unverified relationship produces neither affirmative relationship evidence nor a false negative wiring error. Other independently established observations remain available.
- Zero warnings does not certify exhaustive runtime verification.

### Owning files

Change `projects/core/src/diagnostics/index.ts`, `diagnostic-utilities/index.ts`, `adapter-validation/index.ts`, `adapter-execution/index.ts`, `contracts/index.ts`, `project-validation/index.ts`, `project-inspection/index.ts`, `src/index.ts`, `src/adapter/index.ts`, and colocated tests. Update structural diagnostic construction and scope results consistently without changing structural validity semantics.

Change every adapter's `src/diagnostics/index.ts`, `src/contracts/index.ts`, affected inspection branches, and public-result tests.

Change CLI `src/presentation/{types,transformers,formatters}.ts`, `src/cli-execution/results.ts`, `src/json-output-contract/`, affected paging and composition contracts, consumer fixtures, and documentation. Audit every existing diagnostic-count validity assertion, including website consumers.

### Required verification

Cover clean, warnings-only, errors-only, and mixed results; all-structural-error behavior; malformed severity; wrong code/severity combinations; missing, extra, malformed, or unsafe warning details; invalid relationship/subject combinations; equivalent normalized declarations; non-SemVer redaction; and absence of arbitrary details from CLI output. Also cover stable ordering and digests, distinct source locations and behavior boundaries, raw duplicate-budget exhaustion, warnings on later pages, complete counts on every page, unchanged operational failures, and simultaneous absence of false positive evidence and false negative diagnostics for an uncertain relationship. Exercise real adapters through Core and the packed CLI, not only formatter mocks.

## Version interpretation and shared static analysis

### Preserve eligibility

Keep the current node-semver eligibility rules and minimum-only SDK ranges. Keep prerelease handling, official runtime IDs, target IDs, and Repository Format version 1 unchanged.

Version evidence comes from the existing nearest-manifest discovery path. This work does not require installed SDKs, lockfiles, a registry request, or host `node_modules` during inspection.

Add a private shared classifier for known semantic boundaries. It returns before-boundary, after-boundary, or spanning/unknown behavior based on the existing declarations. Return before-boundary only when every observed declaration is parseable and entirely below the boundary; return after-boundary only when every declaration is parseable and entirely at or above it. Empty, unparseable, spanning, or conflicting declarations return spanning/unknown. Retain existing eligibility and prerelease handling separately. The classifier also supplies the safe normalized union used by version warnings, or `null` if normalization cannot be established. Compare against documented changes only; do not enumerate every release.

For an exact or bounded older declaration, apply the supported older interpretation. For an established newer declaration, apply the newer interpretation. If a declaration spans a demonstrated incompatible behavior, emit the scoped warning and suppress only dependent conclusions.

Keep source-shape recognition primary for additive APIs. Do not infer an installed version from a feature name or add a general rule that all open-ended ranges are uncertain.

### Shared request analysis

Extend `packages/adapter-static-analysis/src/types.ts`, `typescript-analysis/requests.ts`, related module-array analysis, `typescript-analysis/index.ts`, and public private-package exports:

- Replace the single-method setting with one explicit supported-method family per client resource.
- Preserve the recognized call, method identity, first argument, and optional options argument in the private analysis result.
- Discover mixed method families in one traversal. A supported sibling method must not make another supported call ambiguous.
- Preserve lexical ownership, shadowing, optional/computed access handling, module-value mutation and escape checks, cancellation, and conservative spread handling.
- Keep request precedence and SDK helper semantics in the owning adapter.
- Treat recognized transport-only options as irrelevant to canonical wiring. Interpret a statically established body override using the SDK's actual precedence. Dynamic options capable of overriding the body make affected relationships unverified.
- Do not claim that unknown properties are harmless when they can change the relationship being inspected.

Add `src/version-behavior/{index,types,classification}.ts` with colocated unit tests for the known-boundary classifier. Extend existing request-analysis tests for mixed methods, overrides, shadowing, mutation, spread order, and relationship-local ambiguity. Remove the superseded singular method configuration after all consumers migrate.

## Adapter implementation scope

All rows include severity migration, retained older-pattern coverage, current-version evidence, package docs, examples, compatibility-source updates, and packed export verification. No adapter gains provider execution or a provider SDK production dependency.

### Anthropic

Owners: `source-analysis/{source-analysis,messages}.ts`, request contracts, and instruction/tool/schema inspection under `projects/adapter-anthropic/src`.

- Fix second-argument request-body precedence in both positive and negative wiring decisions.
- Support the direct stable `messages.create`, `messages.parse`, and `messages.stream` family where canonical relationships are statically identifiable.
- Recognize direct output-schema wiring through `output_config.format`, including the documented direct schema helper form. Preserve exact bound schema identity; do not infer schema equivalence.
- Handle helper-generated request transformations according to the pinned SDK implementation.
- Test body replacement, transport-only options, dynamic overrides, mixed methods, streaming, direct schema helpers, and actual SDK request construction with a controlled external transport boundary.
- Keep beta resources, tool-runner orchestration, and provider/server-tool execution outside the supported static target.

The [pinned Messages implementation](https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/sdk-v0.128.0/src/resources/messages/messages.ts) establishes the options ordering and stable parse/stream surfaces.

### OpenAI

Owners: `source-analysis/{source-analysis,responses}.ts`, request contracts, and instruction/tool/schema inspection under `projects/adapter-openai/src`.

- Recognize named `OpenAI` constructor imports alongside the existing default import.
- Support direct `responses.create`, `responses.parse`, and `responses.stream` calls with supported request options.
- Interpret effective request bodies conservatively, including override-capable options.
- Add exact output-schema relationships through `text.format`, direct JSON Schema forms, and the documented direct `zodTextFormat` helper.
- Keep model input schemas distinct from response output schemas.
- Test transport-only options, overrides, mixed methods, helper imports, unsupported transforms, and actual SDK request preparation through a controlled transport.

Use the [pinned Responses implementation](https://raw.githubusercontent.com/openai/openai-node/v7.23.0/src/resources/responses/responses.ts) for method and option semantics.

### Google Gen AI

Owners: `projects/adapter-google-genai/src/source-analysis/`, request contracts, and related inspection.

- Support `models.generateContentStream` alongside `generateContent` in one request family.
- Preserve existing instruction, tool, and schema relationships through the shared request shape.
- Test wrappers containing both methods, mixed supported/ambiguous calls, shadowed clients, and relationship-specific failures.
- Do not infer streaming lifecycle or model behavior from the declaration.

The [Models reference](https://googleapis.github.io/js-genai/release_docs/classes/models.Models.html) documents both methods and their request types.

### Claude Agent SDK

Owners: `source-analysis/{source-analysis,query-wrappers,agent-definitions,instruction-loaders,tool-availability}.ts`, `inspection/{inspection,handoffs,tools}.ts`, and related contracts.

- Recognize imports from both the package root and `@anthropic-ai/claude-agent-sdk/core` without following arbitrary package exports.
- Classify `omitClaudeMd`, `verbatimPrompts`, and prompt snapshot controls according to the relationships they actually affect.
- Preserve direct canonical prompt wiring when independent of these controls; do not equate ambient-file omission, prompt delivery, or snapshot timing with canonical instruction identity.
- Retain query-local delegation and MCP availability context through exact agent resolution. The existing ownership path is retained.
- Test inherited and explicit tools, query-local restrictions, multiple parents, unavailable delegation, supported import aliases, and new prompt-control combinations.
- Keep filesystem agents, aliases requiring runtime interpretation, prewarming, and process/session execution outside the target.

These additions and changes are recorded in the [SDK changelog](https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md), particularly 0.3.267, 0.3.271, 0.3.280, and 0.3.282.

### Cloudflare Agents

Owners: `source-analysis/{think-instructions,session-builders,class-definitions,function-tools,think-tools,ai-chat-agents}.ts`, `inspection/package-inspection.ts`, relationship inspection, and contracts.

- Carry package observations into semantic interpretation rather than reducing them to a boolean.
- Support bounded `configureContext` instruction sources and the documented merge order with supported `withContext` sources.
- Apply the pre-0.18 and post-0.18 meaning of `withCachedPrompt`. A proven post-boundary no-op cannot establish instruction wiring; a spanning declaration produces a scoped warning when the conclusion depends on it.
- Preserve independently valid `getSystemPrompt` and supported builder relationships.
- Align AI SDK tool recognition with Vercel AI SDK, including `deferLoading`.
- Verify realistic companion-package combinations in upstream tests. Do not add a runtime table of every released combination.
- Test instruction precedence, multiple configured sources, older and newer forms, ambiguous ranges, and AIChat tool/output behavior.

The [Think 0.18.0 release](https://github.com/cloudflare/agents/releases/tag/%40cloudflare%2Fthink%400.18.0) establishes the context hook, merge ordering, and no-op change.

### Eve

Owners: `repository-discovery/{agent-roots,candidate-index}.ts`, `source-analysis/{helper-imports,object-definitions,source-analysis}.ts`, `inspection/{session,inspection,agent-inspection,tool-inspection,subagent-inspection,package-inspection}.ts`, constants, and contracts.

- Preserve the existing flat and nested roots; add explicit `agents/<name>/agent/agent.ts` workspace roots.
- Support direct `defineWorkspaceAgent` references to exact manifest-registered workspace targets, with bounded resolution and no global agent enumeration.
- Discover each scoped parent's immediate local children at every supported nesting depth. A root-child-grandchild fixture must establish both direct edges.
- Interpret `tool: false`, same-name suppression, and `availableInSubagents` only where their statically established meanings affect exposure. Distinguish callable declarations from model-visible registrations.
- Add direct `defineWorkflowTool` recognition without claiming durable workflow execution.
- Handle the 0.65 default-tool changes and 0.66.2 test-file exclusions through known behavior boundaries. Do not apply current discovery semantics silently to older supported versions.
- Avoid treating removed defaults as permanent reserved names. Keep current reserved-name rules and explicit collisions accurate.
- Index only the scoped root and required relationships, avoid repeated filtering for each child, and preserve collision, extension-namespace, symlink, and malformed-layout safeguards.
- Test removed/default tool collisions, disabled targets, nested parents, workspace references, duplicate slots, test/spec paths, `__tests__`, broad ranges, and unregistered targets.

Primary references: [0.59.1](https://github.com/vercel/eve/releases/tag/eve%400.59.1), [0.65.0](https://github.com/vercel/eve/releases/tag/eve%400.65.0), [0.66.2](https://github.com/vercel/eve/releases/tag/eve%400.66.2), and the [pinned workspace scenarios](https://github.com/vercel/eve/blob/eve%400.66.3/packages/eve/src/compiler/workspace-agent.scenario.test.ts).

### Vercel AI SDK

Owners: `projects/adapter-vercel-ai-sdk/src/source-analysis/{function-tools,tool-maps,tool-loop-agents,generation-wrappers}.ts` and corresponding Cloudflare tool classification.

- Recognize `deferLoading` without rejecting the entire tool declaration.
- Preserve exact implementation and schema wiring while distinguishing declared registration from turn-time availability.
- Share the genuinely identical AI SDK function-tool shape classification with Cloudflare in `packages/adapter-static-analysis/src/ai-sdk-tool-shape/{index,types,classification}.ts`, while leaving registration and availability interpretation in each adapter. Keep this explicitly scoped to the shared AI SDK contract rather than generalizing unrelated provider tools.
- Test static true/false and dynamic deferred-loading values, tool-search-related declarations, and unchanged ordinary tools.

The [pinned tool contract](https://raw.githubusercontent.com/vercel/ai/ai%407.0.114/packages/provider-utils/src/types/tool.ts) defines deferred discovery. Registration evidence must not promise immediate model access.

### LangGraph

Owners: `source-analysis/{functional-api,graph-operations,state-graph-builders}.ts`, runtime-pattern contracts, and inspection.

- Recognize `interrupt(value, { responseSchema })` alongside the existing one-argument form.
- Treat the response schema as resume-value validation, not an agent input/output schema.
- Classify additive node tracing options without suppressing independent graph relationships.
- Test aliases, shadowing, malformed/dynamic options, StateGraph and functional targets, and unchanged graph/schema bindings.

Use the [LangGraph changelog](https://raw.githubusercontent.com/langchain-ai/langgraphjs/main/libs/langgraph-core/CHANGELOG.md) and pinned exported types for the 1.4.15–1.4.18 changes.

### LangChain and OpenAI Agents SDK

Owners: each package's existing `source-analysis/`, `inspection/`, contracts, and tests.

- Reverify the existing complete advertised surfaces against the retained minimum and reviewed current versions.
- LangChain coverage includes `createAgent`, instruction and tool bindings, middleware-dependent ambiguity, structured-output strategies, and companion core compatibility.
- OpenAI Agents SDK coverage includes Agent declarations, tools, handoffs, routing descriptions, instructions, output types, and ambiguity preservation.
- Apply the common diagnostic contract and accurate scoped warnings.
- No structural rewrite or speculative feature expansion is established for either adapter. A newly demonstrated defect within these surfaces must receive a focused correction and regression test.

## Upstream maintenance and test ownership

Add `scripts/upstream-compatibility/` with `index.ts`, `types.ts`, `targets.ts`, `runner.ts`, a source-derived integration test, and colocated fixture inputs. Expose `pnpm upstream:check` and `pnpm upstream:check:latest`.

- The default command uses exact reviewed minimum/current versions and selected known-boundary versions. It is reproducible release evidence.
- The latest command resolves current stable upstream versions for a maintenance report, then tests those exact resolutions in disposable consumers. It does not modify runtime eligibility, source files, or reviewed expectations automatically.
- Use exact, peer-compatible companion versions per scenario. Cover meaningful pairs and semantic boundaries rather than a Cartesian product.
- Type-check representative authored source against real upstream exports. For precedence and pure discovery behavior, exercise the real relevant SDK/compiler code with external transport isolated.
- Do not substitute self-authored SDK declaration stubs for upstream verification.
- Disable package lifecycle scripts during disposable installation. Do not execute repository-under-test code, provider requests, Claude processes, deployed Workers, or durable cloud workflows.
- Keep SDKs out of production dependencies and tarballs. Temporary installations are verification infrastructure only.
- Reuse existing portable package-manager process handling and serial execution. Record resolved versions and source provenance in concise reports.
- Run the pinned check in CI. Keep latest checks explicitly invoked and outside the consumer runtime; a newly released package does not change a passing installed composition.
- Document the maintenance sequence: run latest check, inspect relevant release notes, reproduce a changed contract, update the owning adapter and reviewed fixtures, run regressions, and release affected packages.

Skill qualification evidence remains owned by the skill repository. Do not manufacture a qualification link, advance its date, or present package compatibility tests as skill qualification.

## Production verification for the other public packages

### Repository

Audit and verify existing path validation, memory-reader snapshots, ordering, cursor continuation, byte ranges, UTF-8 boundaries, malformed input, and conformance behavior. Reuse `projects/repository/src` tests and packed testing-peer consumers. Preserve environment neutrality and public subpaths. Add coverage only for a demonstrated contract gap.

### Repository FS

Audit and verify no-follow access, exact-path selection, traversal rejection, source drift, bounded listing and ranges, cancellation, concurrency, cache bounds, and cleanup through the existing reader and integration tests. Exercise real filesystem behavior on the established operating-system matrix. Do not claim Windows safety from Linux-only execution.

### Core and CLI

In addition to diagnostic work, verify malformed adapter output, agent-scope isolation, raw-result resource limits, retained-memory accounting, snapshot consistency, canonical-content boundaries, safe error translation, cancellation, and installed composition.

Packed CLI scenarios must cover `version`, `composition`, `validate`, `inspect`, `scope`, and `content`, including warnings-only and mixed outcomes. Preserve source immutability and the current no-network/no-provider-execution contract.

### Website UI

Retain the existing public component and utility surface unless verification exposes a concrete defect. Run the real tarball installation and Astro consumer build in `projects/website-ui/src/index.test-integration.ts`, plus utility tests and website browser coverage.

Use existing `ResultSummary`, `StatusBadge`, `CodeBlock`, `FilePreview`, `Dialog`, `Accordion`, and theme/site utilities. Existing warning tones already satisfy the proposed diagnostic presentation. Do not introduce equivalent local primitives or change Astro/Tailwind peer versions for this task.

The developer explicitly waived a separate `website-ui-package.md`. Audit Website UI against its existing README, package documentation, public declarations, tests, and packed consumer. The absence of that additional file is not a readiness blocker.

Record a package-by-package result for all fifteen packages in `docs/launch-readiness.md`: reviewed surface, executed checks, artifact verification, discovered defects and resolutions, and remaining limitations. A materially unverified or failing package prevents the final readiness verdict.

## Specification and documentation synchronization

Synchronize the following existing files in `../platform/moldea/context/` as documentation-only implementation deliverables:

| File                                   | Required synchronization                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `runtime-adapter-contract.md`          | Core 5 composition, severity, the exact shared warning payload, validation, counts, safe output, and coordinated adapter majors                                                                  |
| `core-package.md`                      | Error-based completed validity, warning/error counts, diagnostic contracts, inspection behavior, and Core 5                                                                                      |
| `cli-package.md`                       | CLI 9, schema 5, discriminated diagnostic records, complete counts, human warnings, and exit semantics                                                                                           |
| `repository-format.md`                 | Clarify that proof of incorrect routing is required for an error; scoped unverified warnings do not change structural validity or persisted unresolved requirements                              |
| `packages.md`                          | Synchronize affected current CLI/schema references and explicitly allow Website UI's existing package documentation to satisfy its documentation requirement without a new focused specification |
| `adapter-anthropic-package.md`         | Common warning contract and version, effective request options, create/parse/stream methods, and output-schema support                                                                           |
| `adapter-openai-package.md`            | Common warning contract and version, named imports, request options, create/parse/stream methods, and output-schema support                                                                      |
| `adapter-google-genai-package.md`      | Common warning contract and version, streaming generation, and corresponding supported/excluded patterns                                                                                         |
| `adapter-claude-agent-sdk-package.md`  | Common warning contract and version, `/core` imports, prompt controls, and retained query-local relationships                                                                                    |
| `adapter-cloudflare-agents-package.md` | Common warning contract and version, known cached-prompt boundary, `configureContext`, precedence, and deferred tools                                                                            |
| `adapter-eve-package.md`               | Common warning contract and version, nested/workspace discovery, registration/exposure, defaults, and version-sensitive exclusions                                                               |
| `adapter-vercel-ai-sdk-package.md`     | Common warning contract and version, deferred tools, and limits on availability claims                                                                                                           |
| `adapter-langgraph-package.md`         | Common warning contract and version, two-argument interrupts, resume schemas, and additive node options                                                                                          |
| `adapter-langchain-package.md`         | Common warning contract and version; further behavioral text only for verified in-scope corrections                                                                                              |
| `adapter-openai-agents-sdk-package.md` | Common warning contract and version; further behavioral text only for verified in-scope corrections                                                                                              |

Update affected diagnostic catalogs, examples, conformance requirements, and exclusion lists within those files. Replace superseded descriptions of the released package contract; preserve older upstream source forms that remain intentionally supported. Do not change statements about a hosted application's actually installed Core 4 merely because the packages advance to Core 5.

Apply the corresponding narrow routing-diagnostic clarification to `packages/specifications/repository-format.md`, preserving unrelated differences between the documents. Repository Format remains version 1. Synchronize package-owned READMEs/docs, generated references, compatibility YAML, and website consumers with these same contracts.

The platform `runtime-compatibility-matrix.md` already expresses the agreed minimum-only eligibility policy and requires no planned policy or schema change. Update technical entries in `packages/compatibility/runtimes.yaml` and regenerate their presentations. Repository and Repository FS specifications require changes only if an in-scope audit correction changes their documented contract; stop for plan revision if that becomes necessary. Do not create `website-ui-package.md`.

Keep `agent-skill.md`, `context-gathering.md`, and skill implementation changes in the subsequent skill work. The final handoff must identify schema-4 consumption, severity-aware interpretation, and stale package-version references that the next skill revision must address. Do not imply that the existing skill or hosted platform has migrated.

Read current applicable platform instructions and worktree changes before implementation edits. Preserve concurrent author changes and the recent platform ownership clarification. Format only the named changed specification files with that repository's existing formatter. Review both repositories' exact diffs and verify that examples, warning contracts, versions, and boundaries agree; no platform application tests or build are needed for prose-only specification changes. The packages build continues to use local documentation and must not depend on the sibling repository at runtime or in CI.

Specification synchronization is part of completion, not an outstanding handoff or optional follow-up. Record the reviewed platform commit/worktree state and synchronized paths in the launch-readiness report. If the named specifications cannot be updated or concurrent changes create a contract conflict, report the blocker before claiming launch readiness.

## Website and executable examples

Update `apps/website` as an explicit deliverable, not merely as a side effect of regenerated documentation.

### Sources and consumers

- Update affected package READMEs and `projects/<project>/docs/**`, `compatibility/runtimes.yaml`, and generated `docs/runtime-compatibility.md`.
- Update website `src/lib/capabilities/{types,validations,transformers,presentation,catalog}.ts`, CLI example schemas and scenarios, Core examples, runtime fixtures, expected results, and runtime-pattern proofs.
- Update `src/lib/inspection-example/`, `instruction-example/`, and inspection summary/result components wherever diagnostic shape or validity assumptions change.
- Update package discovery/dependency expectations, generated API references, capability coverage accounting, and schema-version consumers.
- Keep `content/runtime-target-maturity.yaml` and qualification links truthful. A new source pattern alone does not prove a maturity promotion.
- Regenerate through the existing commands. Do not edit `.generated/model.json`, built HTML, or generated API artifacts directly.
- Keep the website README's catalog counts synchronized with actual generated cases; do not hard-code old totals into the plan.

### Required example coverage

Add executable cases for:

1. Successful validation with a scoped warning and no affirmative evidence for the uncertain relationship.
2. The same relationship conclusively broken, producing an error and exit 1.
3. A warnings-plus-errors result with correct full counts across pages.
4. Older and newer supported patterns, including the Think behavior boundary and an ambiguous declaration.
5. Anthropic/OpenAI effective request options and structured-output helpers.
6. Google streaming alongside non-streaming calls.
7. Eve nested/workspace registrations and ignored test files.
8. Deferred AI SDK tools and LangGraph resume schemas, with their limited claims stated accurately.

Every newly advertised full/partial runtime pattern must have an executable source witness in the catalog. Reuse cases where one case genuinely demonstrates multiple patterns.

Select a concise public subset through the existing catalog: expose the warning/error distinction and representative new adapter capabilities without publishing every regression fixture. Add examples to the relevant adapter guides as well. Keep examples realistic and bounded, and derive displayed results from actual package execution.

### Website quality gates

- Preserve server-rendered, readable examples without JavaScript and avoid shipping analyzer or provider SDK code to visitors.
- Verify 320px through desktop, both themes, keyboard operation, focus restoration, accessible status text, reduced motion, and long filenames/messages.
- Reuse the existing Astro components and semantic warning/danger tones; status cannot depend on color alone.
- Run existing Playwright and accessibility coverage, add focused scenarios for the new warning presentations, and inspect representative rendered pages.
- Verify links, fragments, search, sitemap, `llms.txt`, adapter target anchors, and `BASE_PATH` behavior through existing generation and artifact checks.
- Keep website generation bounded: each finite catalog case executes once per model generation and reuses the generated model.

## Resource efficiency and scalability

### Preserve the existing safety envelope

Keep independent input, file, entry, retained-memory, output, evidence, and diagnostic limits; do not raise them simply to make tests pass. Preserve the CLI's 65,536-byte default and 1 MiB maximum unless measurements justify a separately reviewed change.

Byte budgets are not token guarantees. Report cumulative serialized bytes and command/page counts; do not present an arbitrary byte-to-token ratio as exact model consumption.

### Measurements and corrections

Add `scripts/resource-calibration/calibration.ts`, colocated integration coverage, reusable synthetic fixture construction, and `pnpm resource:measure`.

Measure complete workflows on ordinary, many-agent/shared-source, broad-tool, deeply nested Eve, dense-warning/error, large-source, and multi-page repositories. Record elapsed time, peak process memory, reader calls/bytes, parser invocations, emitted records, cumulative output bytes, and snapshot attempts. Use repeated samples and fixed inputs; timing results are evidence, not brittle correctness assertions. Obtain detailed counts through fixture-local instrumentation at existing reader and parser boundaries; do not add a public instrumentation API solely for these tests.

Required checks:

- Repeated access inside one inspection session reuses its existing promise caches.
- Eve discovery builds lookup indexes once per scoped root and does not repeatedly scan all descendants for every child.
- New request-method support does not repeat whole-source analysis per method.
- Every new collection is bounded by existing operation limits, with explicit failure rather than partial success.
- Large source and nested syntax fail predictably at supported resource boundaries; AST overhead is measured separately from Core's logical byte accounting.
- Warnings do not cause repeated full inspections or unbounded output accumulation.
- Unstable working trees retain the existing bounded complete-attempt retry behavior.

Retain the stateless CLI and operation-local caches. A fresh CLI continuation currently rebuilds inspection; document and measure that cumulative cost explicitly. Favor targeted `scope` and `content` workflows in package guidance. Prepared Core inspection already supports repeated pages without revalidation within one process.

Do not add persistent or cross-operation caching without evidence and a separately approved design covering snapshot identity, ownership, capacity, invalidation, and failure behavior. If representative launch workloads cannot complete within the documented envelope, readiness is blocked; present the measurements and revise the affected design instead of masking the problem with larger limits.

Record results, supported workload assumptions, and material remaining costs in `docs/launch-readiness.md`. Do not claim unlimited scalability.

## Release propagation and package versions

### Bundled private inputs

Extend `scripts/npm-release/{project-changes,git,types}.ts` and colocated tests to account for committed private workspace inputs.

- Build the relevant private workspace dependency graph from the base and current committed manifests. Treat private workspace dependencies declared in `dependencies` or `devDependencies` as build inputs, including the currently bundled static-analysis package. Do not traverse public development tools as bundled private packages. This conservative rule may select an extra release for a future private development dependency, but cannot silently omit the current bundled implementation.
- Propagate release-relevant private implementation changes through private dependencies to consuming public artifacts. Stop propagation at external public-package boundaries.
- Inspect both graph states so removal, renaming, or replacement of a bundled dependency cannot hide a change.
- Preserve test-only, excluded-directory, and nonshipped-documentation exclusions.
- Treat implementation changes under `configs/vite/` and `configs/typescript/` as release-relevant for their public library-build consumers, with test-only changes excluded. Keep this mapping explicit and covered by the release-selection tests.
- Fail clearly on an invalid dependency graph; do not silently skip a bundled dependency.
- Verify source-only private changes select affected adapters and require version increases. They must not force an unchanged CLI release for a compatible adapter patch.
- Compare real packed artifacts in integration coverage to establish that the selection rule follows shipped behavior.
- Preserve publication ordering, trusted publishing, checksum verification, and recovery semantics.

### Coordinated prelaunch contract release

The required diagnostic field and changed result semantics are breaking package contracts under the existing release policy.

| Package                               | Planned version                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Core                                  | 5.0.0                                                                                                |
| CLI                                   | 9.0.0, implementing JSON schema 5 only                                                               |
| Anthropic and OpenAI adapters         | 5.0.0                                                                                                |
| Other eight adapters                  | 4.0.0                                                                                                |
| Repository, Repository FS, Website UI | Keep current versions unless their shipped implementation or documentation changes require a release |

Update adapters to `workspace:^5.0.0` for Core. Update CLI and website dependency declarations to the new compatible majors. Preserve compatible-major updates within the new contract; this is not lockstep versioning or an exact-patch installation policy.

Update `pnpm-lock.yaml`, CLI composition expectations, package integration/version assertions, compatibility implementation ranges, and package installation examples together.

Implement JSON schema 5 without a schema 4 reader or optional-severity shim. Remove superseded code, tests, and documentation describing the replaced contract. Repository Format version 1, compatibility matrix version 2, and public compatibility JSON schema 1 remain unchanged unless an actual shape change requires reconsideration.

Existing cursors are opaque and must fail when their format or result digest no longer matches. They require no persisted-data migration. No database migration is part of this work.

Publication and deployment remain outside implementation approval. Before publication, registry/tag checks must confirm the proposed versions remain available; never overwrite an existing release. A pre-publication rollback restores the coherent prior source/dependency state. After publication, corrections use new versions through the existing release workflow.

## Ordered implementation strategy

These are strategic steps, not independently authorized milestones.

1. **Establish regression and upstream fixtures.** Turn the confirmed source probes into colocated regression tests, capture minimum/current/boundary provenance, and establish complete-workflow resource baselines. Review expected failures against the intended contracts.
2. **Implement diagnostic severity end to end.** Update Core-owned warning types and validation, all adapters, CLI, immediate website consumers, package documentation, affected platform specifications, both format documents, counts, and schema/version expectations together. Verify a coherent warnings-only result and malformed-warning rejection through real adapter, Core, and CLI boundaries before proceeding.
3. **Extend shared parsing and version interpretation.** Implement the method family, call/options preservation, and known-boundary classifier. Migrate consumers and remove the superseded private configuration. Verify no regression in scope, mutation, or ambiguity handling.
4. **Complete adapter corrections and capabilities.** Implement the adapter scope above with its focused tests, current/minimum SDK evidence, package docs, matching platform adapter specifications, and runtime-pattern witnesses. Review each family's positive, negative, and unverified conclusions before moving on.
5. **Complete the website examples and presentation.** Regenerate authoritative content, add the required executable examples, select public examples, and verify browser/accessibility behavior and generated artifacts.
6. **Close resource and package-readiness gaps.** Run representative aggregate measurements and all fifteen package audits. Apply local corrections supported by findings. Require plan revision before an architectural deviation, new runtime target, persistent cache, or other material scope change.
7. **Complete release propagation and coordinated versions.** Verify private bundled changes, manifests, lockfile, compatible-major dependencies, packed artifacts, documentation, and release-selection checks.
8. **Run the complete launch gates and report readiness.** Record exact verification results and limitations, confirm completed specification synchronization, inspect both repositories' scoped diffs, and produce the next-skill handoff. Stop with a reviewable implementation; do not publish or deploy.

Keep required tests, exports, error documentation, examples, and documentation with their implementation step. A step is not complete while its public contract is inconsistently represented.

## Verification commands and acceptance gates

Use the existing scripts and established serial integration/e2e boundaries. New tests remain colocated, use the existing Node/browser environments, and are excluded from production artifacts. Any new category requires only its minimal discovery/script changes. Ensure the affected shared Vitest configuration, Playwright discovery, and fixture/build traversal explicitly exclude `_archive`, `_archives`, `_backup`, and `_backups` with all descendants; apply the same exclusions to inspection and release-input traversal.

During implementation, run the narrowest relevant package or root suite first, including:

```text
pnpm test:root:unit
pnpm test:root:integration
pnpm --filter @moldea.ai/adapter-static-analysis test
pnpm --filter @moldea.ai/core test
pnpm --filter @moldea.ai/cli test
pnpm --filter @moldea.ai/website-ui test
pnpm upstream:check
pnpm resource:measure
```

Run each changed adapter's existing `test:unit` and `test:integration` scripts through its exact package filter. The final workspace gates are:

```text
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm compatibility:check
pnpm docs:check
pnpm website:check
pnpm --filter @moldea.ai/packages-website test:e2e
```

Reuse successful results for identical inputs rather than rerunning expensive suites mechanically. Root correctness coverage must still include all existing unit, integration, and e2e categories. Format only changed files during development; the final check may inspect the repository.

Use the existing CI consumer matrix: Node.js 22.11.0, latest 22, 24.11.0, latest 24, and 26.8.1 where the packages advertise them; the documented Vitest testing-peer matrix; and Linux, macOS, and Windows jobs. Website UI retains its own Node/Astro/Tailwind contract. Missing required infrastructure is reported as unverified, not passed.

Validate the complete fifteen-tarball inventory, exports/types, runtime dependencies, absence of private workspace imports, absence of tests/source leaks, checksums, and installed composition. Run `release:check-changes` against exact implementation commits once those commits exist; implementation does not create commits merely to run that gate. Its integration tests must exercise the selection rules before then.

### Completion criteria

- All ten adapters satisfy their retained advertised behavior and the explicitly added capabilities.
- Every confirmed defect has a regression test through the meaningful boundary.
- Older/newer support and known semantic differences are distinguished without new runtime version ceilings.
- Warnings are actionable, nonblocking, bounded, and visible through Core, CLI, and website examples; errors and operational failures remain effective.
- No uncertain relationship is simultaneously presented as verified.
- All fifteen packages have passing applicable regression, type, artifact, and consumer checks, with no unresolved material correctness or verification finding.
- The packages website accurately presents the new contracts and examples and passes required visual, accessibility, responsive, theme, and artifact checks.
- Private bundled changes cannot silently escape release selection.
- Resource measurements establish the documented launch envelope and expose cumulative costs.
- Documentation, exception contracts, diagnostic catalogs, JSDoc, compatibility data, and generated presentations agree with implementation.
- The listed platform specifications and local format wording are synchronized; recent unrelated edits are preserved. Website UI readiness does not depend on creating a separate specification.
- No obsolete Moldea contract implementation or unjustified compatibility layer remains.

## Risks, handoffs, and limits of the result

- Upstream releases may occur during implementation. Recheck latest versions at final verification; report additional relevant changes explicitly instead of silently expanding scope or narrowing eligibility.
- Static analysis establishes bounded source relationships. It does not prove model behavior, runtime execution, provider acceptance, or compatibility with every future release.
- Warnings intentionally allow work to continue with a named unverified conclusion. The next skill must preserve that distinction and seek targeted evidence when its task depends on it.
- Core logical retained-byte limits are not a process-RSS guarantee. Resource calibration must examine parser and object overhead as well as repository bytes.
- Stateless CLI continuation retains repeated preparation cost. A passing single-page test is not evidence for an acceptable complete traversal.
- The named platform specification updates are documentation-only deliverables within this plan. They do not migrate hosted consumers or the skill, change their installed dependencies, or authorize broader platform edits. Cross-repository commits and publication remain separate actions.
- Skill qualification and its published evidence remain separate work. Preserve truthful links and identify any evidence that needs renewal.
- Protected coding instructions already cover the general engineering workflow. Reassess their durable guidance after implementation and provide a separate-model handoff only if an actual gap remains.
- No production-readiness claim is made by creating this plan. The verdict depends on completed implementation and verification evidence.

## Approval required

Approve implementation of the coordinated diagnostic contract and exact shared warning payload, the specified ten-adapter updates, shared analyzer changes, upstream compatibility checks, resource calibration and justified local corrections, release propagation and version updates, verification of all fifteen public packages, packages website/documentation/examples, and the explicitly listed documentation-only platform specification synchronization.

Approval does not authorize npm publication, website deployment, commits, platform application changes, other cross-repository changes, a new Website UI specification, or the next skill implementation. If milestone-based execution is desired, run `breakdown` before implementation.
