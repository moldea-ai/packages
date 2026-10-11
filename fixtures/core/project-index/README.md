# Core universal project-index fixtures

These fixtures compose every universal version 1 repository-format phase through the immutable `@moldea.ai/repository/memory` reader.

- `cases.json` defines a complete project, a minimal context-only project, every valid tool and skill combination, independent content failures, and a manifest failure alongside phases that remain independently valid. Each case identifies its exact project golden or explicitly expects no authoritative index.
- `complete.expected.json` is the exact serialized provisional project-index golden.
- `minimal-context.expected.json` is the exact context-only project-index golden with no agents.
- `capability-combinations.expected.json` is the exact project-index golden for agents with tools only, skills only, both, and neither.
- `diagnostics.expected.json` records complete deterministic diagnostic values for every case.
- The complete case includes project and focused context, runtime guidance, decisions, registered agents with an optional handoff description, relationships, repository references, unresolved requirements, and an exact instruction mirror.
- Invalid cases preserve all-or-nothing indexing while retaining deterministic, path-ordered diagnostics without dependent cascades.

Public `inspectProject` returns the index as authoritative project state only when validation has no errors. The colocated integration suites also verify binding coverage and warning counts.
