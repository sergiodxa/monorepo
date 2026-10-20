# ADR-168: Pairing `.spec` files from `sdxc make` and `sdxc scaffold`

## Status

**Accepted** - 2026-10-20

## Background

ADR-143 and ADR-163 write Vitest tests beside generated handlers. Those tests exercise the
handler in-process. Black-box coverage against a running app belongs in `@sdxc/spec` `.spec`
files under `spec/`, which apps already author by hand. Generating a stub suite with each
controller, command, MCP tool or scaffold removes the blank page and names the right capability
(`browser`, `http`, `cli` or `mcp`).

## Context

- `@sdxc/spec` runs `.spec` files with explicit `--allow-*` grants. Controllers that render pages
  are reached with `browser`; JSON endpoints with `http`; app commands with `cli`; MCP tools with
  the new `mcp` capability (ADR companion in `@sdxc/spec`'s README), built on `fetch` for the
  Streamable HTTP transport `@sdxc/mcp` serves.
- `sdxc make` already pairs a Vitest file through `make.tests` and kind stubs named
  `*.test.stub`. Scaffold writes many files and one resource's worth of Vitest coverage.
- Specs live under `spec/`, not beside the TypeScript source, because they exercise the running
  app rather than a module.

## Decision

### Configuration

| Key          | Default | Meaning                                                                                          |
| ------------ | ------- | ------------------------------------------------------------------------------------------------ |
| `make.specs` | `true`  | Write a pairing `.spec` for controllers, commands, MCP tools, and one feature suite per scaffold |

`--spec` / `--no-spec` override the setting for one run, parallel to `--test` / `--no-test`.

### Pairing paths and stubs

| Generator                          | Spec path                   | Stub(s)                                            | Capability |
| ---------------------------------- | --------------------------- | -------------------------------------------------- | ---------- |
| `make controller` (web)            | `spec/<name>.spec`          | `controller.spec.stub`                             | `browser`  |
| `make controller` (`--routes api`) | `spec/<name>.spec`          | `controller.api.spec.stub`                         | `http`     |
| `make command`                     | `spec/commands/<name>.spec` | `command.spec.stub`                                | `cli`      |
| `make mcp` (tool)                  | `spec/mcp/<name>.spec`      | `mcp.spec.stub`                                    | `mcp`      |
| `make mcp --resource`              | none                        | (resources have no pairing `.spec`)                | —          |
| `scaffold`                         | `spec/<plural>.spec`        | `scaffold.spec.stub` with `{{uses}}` / `{{cases}}` | mixed      |

Scaffold emits one suite for the whole feature. `{{uses}}` and `{{cases}}` list only the
surfaces the run wrote (pages, `--api`, `--mcp`, `--command`).

### Dependencies and template

Writing a `.spec` adds `@sdxc/spec` to `package.json` when it is missing, the same way imported
`@sdxc/*` packages are added. The app template ships `@sdxc/spec` and a starter
`spec/config.jsonc` with a `web` base and the grants a local black-box run needs.

### Destroy

`sdxc destroy` removes the pairing `.spec` when it exists, beside the file and its Vitest test.

## Consequences

### Positive

- A generated handler ships with a black-box stub that names the right capability and URL or
  tool, so an author fills expectations instead of inventing the suite shape.
- Scaffold keeps one feature-level suite instead of one `.spec` per generated file.

### Negative

- Projects that do not run `@sdxc/spec` yet get stub files under `spec/` until they opt out with
  `make.specs: false` or `--no-spec`.

### Neutral

- Vitest companions stay beside the source; `.spec` companions stay under `spec/`. The two are
  independent toggles (`make.tests` and `make.specs`).

## Alternatives considered

- **Colocate `.spec` next to the controller.** Rejected: existing apps and the `@sdxc/spec`
  runner treat `spec/` as the suite root, and black-box tests are not module tests.
- **Generate a `.spec` for every kind.** Rejected: middleware, models and jobs have no single
  black-box entry the suite can name without inventing a URL or command.
- **A new `--allow-mcp` grant.** Rejected: privilege is network reachability; `--allow-net`
  already gates `http` and `browser`.

## References

- [ADR-143: `sdxc make` Generators](./ADR-143-sdxc-make-generators.md)
- [ADR-163: `sdxc scaffold`](./ADR-163-sdxc-scaffold.md)
- [`@sdxc/spec` README — `mcp` capability](../../packages/spec/README.md)
