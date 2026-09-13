# Publish adapter documentation with installed packages

## Objective and original issues

Make all ten official adapters locally self-documenting without changing runtime behavior or running paid evaluations. Their repository-owned documentation was omitted from npm packages; six installed READMEs linked to missing guides. This encouraged unnecessary source exploration. Existing artifact tests did not require documentation, and release selection unconditionally excluded docs, preventing later shipped-document fixes from reaching users.

## Completed implementation

Signed commit bd51c27aeb3e5913e89f861f629135b2a3fb4557 on packages main adds docs to all ten adapters, README navigation, shared packed-document verification, committed-manifest-based documentation release selection, corresponding tests, cache inputs, and packaging/release guidance. Exports, dependency ranges, engines, adapter implementations, the skill, and qualification evidence are unchanged. Root tests, all adapter suites, lint, typechecking, compatibility checks, documentation-source checks, and ten real tarball inspections passed. The platform specification already permits publishing package docs and needs no correction.

## Review finding and revised final contract

The full website build found that the additional local-guide links in docs/index.md render as nonexistent website .md routes. Publication and deployment stopped before releasing the candidate. Documentation-source validation alone was insufficient; full website build validation must precede the recovery push.

Remove the redundant Local guides section from each adapter documentation index. Keep direct package-local navigation to all four guides in every README. Preserve the website's existing navigation and the explicit, verified HTTPS links for generated API references and compatibility pages. Do not modify the website renderer, duplicate documents, add redirects, or introduce compatibility/fallback behavior.

## Remaining implementation scope

- projects/adapter-*/docs/index.md: remove only the added Local guides section; retain website-link corrections and all technical claims.
- README.md: state that README links provide local navigation, without claiming additional index navigation.
- Existing configs/package-documentation verification, adapter artifact tests, scripts/npm-release selection and tests, package manifests and docs/npm-releases.md remain the authoritative implementation.
- Preserve candidate versions if the registry confirms they remain unpublished: Anthropic and OpenAI 4.0.1; Eve, LangChain and LangGraph 3.0.2; the other five adapters 3.0.1. Use the existing documented unpublished-candidate recovery workflow, not new release logic.

## Verification and review

Run targeted Prettier and git diff --check; regenerate and fully build the packages website with pnpm website:build --output-logs=errors-only, including its existing complete internal-link/artifact validation. Repack all ten adapters and verify all four guides and README contents against actual tarballs, using the shared documentation check for local links. Reuse passed runtime, unit, integration, lint and typechecking evidence whose executable inputs remain unchanged. Confirm package versions are still unpublished and no unrelated paths, runtime code, tests, lockfiles or compatibility ranges changed in recovery. Review the complete correction and the cumulative task result before publication.

## Publication and completion

Work remains isolated on adapter_package_docs at /tmp/moldea-adapter-docs.K6MW2x; preserve other worktrees and unrelated agents' work. Challenge this revision, evaluate breakdown, complete the cohesive recovery scope, review, fix findings and review again, then repo push with a signed and signed-off commit. Fast-forward only the reviewed work into main under existing autonomous authorization. Monitor the existing trusted npm and website workflows; verify all ten registry tarballs before claiming completion. Do not overwrite tags, released artifacts or history. Report any genuine capability or unrelated CI blocker without bypassing checks.

## Exclusions and resource controls

No paid semantic evaluations or adapter qualifications, skill release, SKILL.md changes, runtime changes, new dependency, SDK-range change, website/UI redesign, migration shim, legacy path, skill-mock edit, or unrelated cleanup. The guides add approximately 86 KB across all ten adapters. Verification reuses existing package checks and bounded static artifacts; no new caching system or arbitrary resource ceiling is needed. Keep the original defect and the website-build oversight recorded in this plan.

## Approval required

The user has authorized autonomous completion of this task and its workflow. This revision removes redundant navigation and strengthens required verification without changing the requested outcome; no additional approval checkpoint is requested.
