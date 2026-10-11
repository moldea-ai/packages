# Shared internal packages

Every immediate directory under this path is a private implementation package shared by multiple first-class projects.

Internal packages are introduced progressively after genuine cross-project reuse exists. They remain private, must not depend on first-class projects, participate in an acyclic dependency graph, and must not leak into the runtime resolution or generated declarations of a published package.

There are currently no private implementation packages. Core owns the universal syntax-only export checker. Introduce a shared package only when multiple public projects actually need the same implementation.
