# Adapter binding examples

## Objective and observed problem

In the `eve future prediction 7` session, skill 5.0.8 reused its instructions and kept six CLI responses to 4,473 bytes, but the coding agent still searched adapter and Core source to discover manifest binding syntax, output-schema wiring, and routing descriptions. Prevent that avoidable exploration with locally shipped, adapter-specific examples. Do not redesign the skill or claim that static inspection establishes live model behavior.

## Repository evidence

The packages worktree was clean on `development`, an ancestor of current `origin/main`. Work proceeds on `adapter_binding_examples`, created from main commit `8e664855ba6136750f80f6e0b991074f11d039c8`; no existing branch or work is discarded. All ten adapters publish `docs` and use `configs/package-documentation` to verify their packed documentation. Their READMEs link conceptual target guides but lack complete manifest-to-source examples. Existing `fixtures/adapter-*/cases.json`, package-owned integration tests, source-pattern contracts, and public Core validation provide deterministic verification boundaries. Some conformance fixtures intentionally contain non-executable schema stubs, so they must not be copied verbatim as application starters.

## Final scope

- Add `projects/adapter-*/docs/binding-example.md` for all ten package-backed adapters. Show complete, small source-inspection examples with repository-format manifest, canonical instructions, runtime source, supported schema/tool relationships, and handoffs where supported. Include both targets where one package has two materially different patterns. Explain unsupported relationships rather than implying generic SDK support.
- Link the example directly from each adapter README and documentation index. Keep common manifest semantics in the existing Repository Format specification; explain the adapter-specific mapping beside each example.
- Read the Markdown file blocks in deterministic tests and inspect them with the actual adapter and Core. Assert positive evidence as well as absence of diagnostics, so an unsupported example cannot pass vacuously. Include negative binding checks and parser boundary tests.
- Reuse the existing packed-documentation check to ensure examples and local links ship. Add only a small test-support parser under `configs/package-documentation`; no generated documentation pipeline, duplicated fixture copy, persistent cache, new dependency, or public runtime export.
- Increment patch versions for the ten changed published adapters, synchronize version assertions and generated compatibility documentation, and refresh the lockfile only where required. No runtime dependency-range changes or forced downstream CLI/skill release.
- Review relevant platform specifications for consistency. Existing package-owned documentation, target support, and independent release contracts remain unchanged; modify a specification only if this implementation actually makes its statements stale. No hosted platform, knowledge-base, or UI redesign work.

## Exclusions and safety

Do not modify `skill-mock`, protected coding instructions, unrelated concurrent work, adapter algorithms, Core, CLI, skill instructions, qualification contracts, or evidence descriptors. Run no paid semantic evaluations, adapter qualifications, provider calls, or deployment of sample applications. Preserve previous paid evidence attribution unchanged. The new examples prove static binding recognition, not provider execution, credential availability, schema acceptance by every provider, or production deployment readiness. All example files are interpreted in an in-memory repository and never executed.

## Implementation sequence

1. Finalize the supported pattern and example surface for each adapter from its own docs, fixture, and implementation. Author the small Markdown examples with real schema definitions and truthful canonical instruction consumption. Cover Eve's default-export symbol, Markdown mirror or loader path, output schema, and exact child routing text explicitly.
2. Add the shared file-block reader and tests at the existing documentation-test boundary. Add per-adapter integration tests using the example as the sole source. Verify expected agent/runtime, instruction, schema, tool, and handoff evidence as applicable, and deliberately break bindings to establish failure detection.
3. Synchronize package entry links, patch versions, version assertions, generated compatibility documentation, and any actually affected state-bearing documentation. Preserve existing public runtime bytes and dependency constraints.
4. Run focused example tests, all ten affected adapter correctness suites, root documentation helper tests, relevant typechecking, linting, formatting, packed-documentation checks, and website documentation/build checks. Inspect the full diff and repeat review after correcting findings.
5. Commit with sign-off and signature, push the feature branch, open and merge the scoped PR after CI succeeds, and verify automatic npm publication and documentation deployment. Do not override protected branches or publish unrelated commits.

## Verification and resource use

Use `pnpm exec vitest run --config vitest-integration.config.ts` for root helper integration checks and `pnpm exec vitest run --config vitest.config.ts` for root unit checks. Each affected package uses its existing `test`, `typecheck`, and `lint` scripts. Use targeted Vitest file execution for initial example development, then `pnpm --filter './projects/adapter-*' --workspace-concurrency=1 test` for the affected regression boundary. Build the CLI dependency closure before dependent package checks when needed. Use `pnpm compatibility:generate`, `pnpm docs:check`, `pnpm website:build`, and targeted Prettier checks. Run `pnpm release:check-changes <base> <commit>` after the candidate commit exists.

Examples are fixed, small developer-owned documents; parse only the selected file, with no recursive repository scans, provider execution, package installations per example, or disk-backed cache. The existing package packing and CI suites retain their established resource controls. Tests must cover malformed blocks, duplicate or unsafe virtual paths, and valid examples without turning this into a general Markdown interpreter. No test-only helpers may enter published runtime code.

## Challenge and revision

The initial proposal to reuse conformance fixtures verbatim was rejected during challenge: several fixtures contain dummy schemas and instruction loaders that return literals. The final plan instead authors explicit source-inspection examples and tests those exact Markdown blocks. Positive evidence assertions are required because zero diagnostics alone can mean unsupported source. Release scope excludes downstream packages whose compatible ranges already accept the patch releases. No unresolved material design decision remains.

## Breakdown

This is one coherent implementation scope. Splitting shared example verification, adapter documentation, and publication would manufacture partial releases and repeat CI. No `milestones.md` is needed; complete, review, and publish the whole adapter documentation batch together.

## Approval required

The current request authorizes autonomous completion of this bounded adapter documentation, deterministic testing, and publication task. Planning, challenge, revision, and breakdown assessment are complete; proceed without a further approval pause. Paid evaluations and unrelated changes remain excluded.
