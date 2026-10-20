---
title: Diagnostics
description: Navigable diagnostic taxonomy, normalized shape, stable ordering, limits, and operational exceptions.
order: 30
---

# Diagnostics

Diagnostics describe repository findings from a completed inspection. Errors mark invalid structure or a proven missing declared file or runtime export. Operational exceptions mean that configuration was invalid or inspection could not complete reliably.

Every diagnostic has required `severity: 'error' | 'warning'`, `group`, stable `source: 'core'` and `code`, a human message, a logical path or `null`, optional JSON Pointer and scalar-based normalized source range, optional entity identity, and JSON-safe details. Consumers should branch on these fields rather than message text. A result is valid when it has no errors. Complete `errorCount` and `warningCount` accompany validation; prepared-inspection pages report `counts.errors` and `counts.warnings` for the complete result. Accepted warnings are counted separately as described below.

## Diagnostic catalog

The public `ICoreDiagnosticCode` union is the machine-readable catalog. The headings below correspond to the `discovery`, `manifest`, `references`, `agents`, `mirrors`, and `integration` groups.

### [Discovery and text](#discovery-and-text)

Manifest presence, canonical paths, entry types, UTF-8 or Unicode validity, NUL, and empty text use `MOLDEA_MANIFEST_*`, `MOLDEA_PROJECT_FILE_*`, `MOLDEA_ENTRY_TYPE_INVALID`, `MOLDEA_CANONICAL_*`, and `MOLDEA_TEXT_*` codes.

### [YAML and manifest values](#yaml-and-manifest-values)

Malformed or unsupported YAML and invalid Repository Format fields use `MOLDEA_YAML_*`, `MOLDEA_MANIFEST_*`, `MOLDEA_ID_*`, `MOLDEA_VARIABLE_ID_INVALID`, `MOLDEA_PATH_*`, `MOLDEA_GLOB_INVALID`, and `MOLDEA_PATTERN_DUPLICATE` codes.

### [References, context, and decisions](#references-context-and-decisions)

Missing or invalid references, context relationships, runtime guidance, and decision files or graphs use `MOLDEA_IMPACT_*`, `MOLDEA_REFERENCE_*`, `MOLDEA_SYMBOL_*`, `MOLDEA_CONTEXT_*`, `MOLDEA_RUNTIME_GUIDANCE_*`, and `MOLDEA_DECISION_*` codes.

`MOLDEA_REFERENCE_EXPORT_MISSING`: The referenced export is missing. This error is emitted only when a complete syntax-only inventory proves absence. Its details identify the path, symbol, and binding relationship. The same binding has a `failed` coverage record. An unsupported or inconclusive inventory produces `not-checked` coverage rather than an error.

### [Agents and capabilities](#agents-and-capabilities)

Agent directories, identity, descriptions, instructions, variables, runtime labels, tools, and skills use `MOLDEA_AGENT_*`, `MOLDEA_RUNTIME_*`, `MOLDEA_VARIABLE_*`, `MOLDEA_CAPABILITY_*`, `MOLDEA_TOOL_*`, and `MOLDEA_SKILL_*` codes.

### [Mirrors](#mirrors)

Mirror path validity, presence, type, and digest coherence use `MOLDEA_MIRROR_*` codes.

### [Coding-agent integration](#coding-agent-integration)

Validation and inspection check `/AGENTS.md` as untrusted text. A symlinked `/AGENTS.md` is followed inside the repository with Repository's `resolveRepositoryLink`. Integration warnings identify the checked instruction file with `entity.integrationPath` and `subject`: `/AGENTS.md`, or a Claude Code file for the Claude check. Their qualifier is `null`, except `MOLDEA_INTEGRATION_LINK_UNRESOLVED`, whose qualifier is its reason.

- `MOLDEA_INTEGRATION_BLOCK_MISSING`: The AGENTS.md moldea block is missing. Details report a missing, directory, regular, or linked entry and, where relevant, an invalid managed region or invalid UTF-8.
- `MOLDEA_INTEGRATION_SKILL_MISSING`: The skill installation referenced by the AGENTS.md moldea block was not found. Details identify an unextractable installation path or the referenced installation and missing or non-regular contract file.
- `MOLDEA_INTEGRATION_BLOCK_STALE`: The AGENTS.md moldea block differs from its skill installation. Details identify the referenced installation and an invalid asset encoding where applicable.
- `MOLDEA_INTEGRATION_LINK_UNRESOLVED`: This instruction file's link doesn't lead to a file in the repository. The qualifier and `details.reason` name why: `outside` for text that is absolute, starts with a drive prefix, or climbs above the root; `missing`; `loop`; `not-file`; or `unsupported` for unreadable text or `..` after a named segment. An acceptance matches only its reason. The subject is `/AGENTS.md` or the Claude Code file whose link doesn't resolve.
- `MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING`: Claude Code instructions do not load AGENTS.md. Reported for the governing Claude Code file, `/CLAUDE.md`, `/.claude/CLAUDE.md`, or `/CLAUDE.local.md`, when none of the counted files imports or links to AGENTS.md. Details report the entry kind.

The installation must have regular `SKILL.md`, `scripts/relevance-gate.mjs`, and `assets/managed-agents-block.md` files. Core renders the installed asset with the relative skill path and the managed region's line ending before comparison. A current block produces no warning. These checks do not run during manifest-only operations or scope matching.

## Warning identity and acceptance

Warnings carry `subject` (a canonical repository path), `qualifier` (a pattern or acceptance-entry pointer, otherwise `null`), and `acceptable`. The flag is true exactly for codes exported in `ACCEPTABLE_WARNING_CODES`. The list contains `MOLDEA_IMPACT_PATTERN_UNMATCHED`, `MOLDEA_INTEGRATION_BLOCK_MISSING`, `MOLDEA_INTEGRATION_SKILL_MISSING`, and `MOLDEA_INTEGRATION_BLOCK_STALE`.

`MOLDEA_IMPACT_PATTERN_UNMATCHED`: The impact pattern matches no files. This `references` warning identifies an owner and a pattern. Its subject is the owning context or decision path, or the owning agent's canonical instruction path for agent, tool, and skill impacts. Patterns can intentionally cover future files. They are checked after required validation, sharing one traversal per fixed directory prefix and stopping when every pattern has found a regular file. A Core or reader resource refusal suppresses this optional pass's findings and marks it incomplete. Cancellation and source failures still propagate.

The manifest may accept a warning with a reason:

```yaml
acceptedWarnings:
  - code: MOLDEA_IMPACT_PATTERN_UNMATCHED
    subject: /moldea/project.md
    qualifier: /future/**
    reason: This directory is reserved for the next release.
```

Entries match `code`, `subject`, and `qualifier` exactly. Omitted and `null` qualifiers mean the same identity. Each reason must contain non-whitespace text and at most 256 Unicode scalar values. Unknown fields, unsupported codes, malformed entries, missing reasons, and duplicate identities produce `MOLDEA_MANIFEST_VALUE_INVALID` with `entry`, `field`, and `reason` details. `maxAcceptedWarnings` defaults to 256 entries; exceeding that operation limit raises `RESOURCE_LIMIT_EXCEEDED`.

A match retains the warning with `accepted: true` and its reason. `warningCount` includes only unaccepted warnings; `acceptedWarningCount` counts accepted warnings; `diagnosticCount` equals `errorCount + warningCount + acceptedWarningCount`. Inspection counts use `warnings`, `acceptedWarnings`, `errors`, and `diagnostics`. Acceptance never changes validity or errors.

`MOLDEA_ACCEPTANCE_UNMATCHED`: The warning acceptance matches no reported warning. This `manifest` warning has subject `/moldea/moldea.yaml`, qualifier `/acceptedWarnings/<index>`, and `acceptable: false`. It is emitted only when the relevant warning-producing check completed. Skipped checks neither apply nor invalidate their acceptances. The standalone scope matcher validates the acceptance list but runs neither warning check nor acceptance matching.

## Ordering and limits

Core normalizes diagnostics into deterministic order using their source location and identity fields rather than discovery timing. A manifest JSON Pointer retains the entry's authored array position, including agent context, decision, and mirror lists. Parsed manifest lists preserve that order; derived project indexes remain sorted independently. `maxDiagnostics` bounds raw diagnostic production; exceeding it raises `RESOURCE_LIMIT_EXCEEDED` instead of silently truncating the invalid state.

## Operational exceptions

`CoreConfigurationException` reports invalid limits. `CoreOperationException` reports invalid operation arguments, resource exhaustion, cancellation, or isolated-process failure. Repository access, snapshot, cancellation, and resource exceptions propagate through the inspection boundary. Expected missing or non-file integration reads produce the integration warnings above; a reader or memory-ledger resource refusal during the optional impact-pattern pass suppresses only that pass. Other operational failures never become content diagnostics.

Core owns these stable exception contracts:

| Code                        | Stable message                                          |
| --------------------------- | ------------------------------------------------------- |
| `INVALID_RESOURCE_LIMIT`    | A Core resource limit is invalid.                       |
| `INVALID_ARGUMENT`          | The Core operation received an invalid argument.        |
| `ABORTED`                   | The Core operation was aborted.                         |
| `CONTENT_INVALID`           | The canonical content is not valid UTF-8 text.          |
| `RESOURCE_LIMIT_EXCEEDED`   | A Core resource limit was exceeded.                     |
| `INSPECTION_BUSY`           | Project inspection capacity is busy. Try again shortly. |
| `INSPECTION_TIMEOUT`        | The isolated project inspection timed out.              |
| `INSPECTION_PROCESS_FAILED` | The isolated project inspection failed.                 |

Busy and timeout failures are retryable; process failures are not. Timeout does not establish an input or heap limit. Verified worker heap exhaustion uses `RESOURCE_LIMIT_EXCEEDED` with the existing message `A Core resource limit was exceeded.`, `limit: maxAnalysisHeapBytes`, the startup-reported V8 heap maximum, unknown `observedUsage: null`, and `nextAction: review-inspection-capacity`. It carries no inferred source path. Logical resource refusals retain their measured or projected usage and `reduce-input-or-increase-limit` action.

Fixed `maxInspectionMessageBytes` and `maxReaderRequests` transport refusals carry observed usage and `nextAction: null`; these limits cannot be raised by a caller.
