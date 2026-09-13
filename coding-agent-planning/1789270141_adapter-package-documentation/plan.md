# Publish adapter documentation with installed packages

## Objective and original issues

Publish the existing guides in all ten official adapter packages so coding agents can read the relevant local documentation instead of exploring implementation sources. Six installed READMEs previously linked to omitted guides. Artifact tests did not detect missing documentation, and release selection excluded shipped docs from version checks.

## Completed work and findings

Commit bd51c27aeb3e5913e89f861f629135b2a3fb4557 adds the package files, README navigation, shared packed-document verification, artifact regressions, manifest-aware release selection, cache inputs, and release documentation. Commit c2036dbdf1b96b9c2ce4429ba03a7a3d623772bb removes redundant index navigation that broke website routes. The full website build and all ten real tarball checks now pass. Earlier root and adapter suites, lint and typechecking passed.

CI then exposed a missed downstream test: projects/cli/src/bin/index.test-e2e.ts expects old adapter versions even though its installed tarballs correctly contain the new versions. This is stale test data, not a runtime regression. Both verification omissions remain recorded here.

## Remaining implementation

Update only that CLI test and this plan. Derive the exact expected composition package names and versions from the thirteen source package manifests corresponding to the tarballs installed by the test. Retain the complete ordered package list and strict comparison; never derive expectations from observed CLI output. Preserve all other composition, installation, Git-state, cancellation and error checks.

Run the CLI package's full test script, then its typecheck and lint scripts, targeted Prettier and git diff --check. Reuse the unchanged website build, adapter suites and tarball evidence. Review the full correction and cumulative task scope, then perform signed repo push and fast-forward main under existing autonomous authorization. Monitor npm publication and website deployment and verify all ten published tarballs before reporting completion.

## Versions and boundaries

Keep the existing candidate patch versions only while npm confirms they remain unpublished: Anthropic and OpenAI 4.0.1; Eve, LangChain and LangGraph 3.0.2; the other five adapters 3.0.1. The existing release recovery workflow owns this behavior. The test correction must not require a CLI release.

Work remains isolated on adapter_package_docs in /tmp/moldea-adapter-docs.K6MW2x. No production runtime, exports, SDK ranges, dependencies, lockfiles, platform specification, website renderer, skill, protected instructions or skill-mock changes. No paid evaluations, compatibility shim, legacy implementation or unrelated cleanup. Existing docs, release machinery and test fixtures remain authoritative.

## Approval required

The user authorized autonomous completion and publication. This revision corrects required downstream verification within that scope; no additional approval checkpoint is requested.
