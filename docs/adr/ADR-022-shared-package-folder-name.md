# ADR-022: Shared Package Folder Name

## Status

**Accepted** - 2026-07-23

## Background

The monorepo separates deployable applications from reusable shared packages. A content edit used `libraries/` as the shared package folder in public examples, but the repository architecture uses `packages/`.

## Context

The root layout is `apps/` for deployable applications and `packages/` for shared packages. This naming appears in workspace configuration, documentation, package extraction guidance, and developer expectations across the repository.

Using `libraries/` in examples creates an inconsistent mental model and makes future agents more likely to produce folder structures that do not match the repository.

## Decision

Use `packages/` as the folder name for shared packages in this monorepo and in examples that describe this monorepo architecture. Do not use `libraries/` as an alternative folder name when documenting shared package layout.

## Consequences

### Positive

- Documentation matches the repository structure.
- Workspace examples stay consistent with `apps/*` and `packages/*`.
- Future package-related changes have one canonical folder name to follow.

### Negative

- Generic monorepo examples have less naming flexibility when they are meant to reflect this repository's architecture.

### Neutral

- Public content can still use generic package names, but folder layout examples should use `packages/` when discussing shared packages.
