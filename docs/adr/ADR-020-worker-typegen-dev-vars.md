# ADR-020: Worker Typegen Uses Default Dev Vars

## Status

**Implemented** - 2026-07-23

## Background

Worker applications need local variable definitions when running `wrangler types`,
because Wrangler can only generate `Env` fields for variables it can see in
committed config or Wrangler's default local variable file.

## Context

The repo convention is to store local Worker variables and secret placeholders in
`.dev.vars`. Wrangler loads that file by default, so passing
`--env-file .dev.vars` duplicates the default behavior and makes future agents
look for extra configuration that should not exist.

## Decision

Worker typegen scripts should run plain `wrangler types` and rely on Wrangler's
default `.dev.vars` loading. Do not create app-specific `.dev.args` files or add
redundant `--env-file .dev.vars` flags for this purpose.

## Consequences

Wrangler type generation reads the same local variable file used by Worker
development without extra script flags.
