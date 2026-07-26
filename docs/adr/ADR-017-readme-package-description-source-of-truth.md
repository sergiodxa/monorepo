# ADR-017: README Package Description Source of Truth

## Status

**Accepted** - 2026-07-23

## Background

The root README package table was refreshed from workspace names and inferred descriptions. That introduced incorrect descriptions for packages whose names are ambiguous without reading their package README and current implementation.

## Context

Three package descriptions were corrected during README review:

| Package             | Correct description                      |
| ------------------- | ---------------------------------------- |
| `@pkg/location`     | URL-like path `Location` class           |
| `@pkg/r3-ui-router` | SPA router for Remix UI apps             |
| `@pkg/u`            | Tailwind-like Remix UI styling utilities |

The `apps/r3-gallery` README also needed the concrete Workers.dev production URL instead of generic deployment wording.

## Decision

Root README package descriptions must be sourced from each package's own README or implementation contract, not inferred from package names. App README production URLs must use the concrete configured URL when one exists.

## Consequences

- Future inventory updates need to inspect package/app documentation before changing descriptions.
- Ambiguous package names should keep concise but architecture-accurate descriptions in the root README.
- Corrections are documented so future agents do not repeat the same assumptions.
