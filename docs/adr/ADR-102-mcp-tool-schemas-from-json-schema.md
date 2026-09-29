# ADR-102: MCP Tool Schemas From `@sdxc/json-schema`

## Status

**Implemented** - 2026-09-29

Supersedes §4 ("One Schema, Three Consumers") of
[ADR-036](./ADR-036-model-context-protocol-server-package.md) and its rejected alternative 3.

## Background

ADR-036 declared a tool's arguments as a hand-written JSON Schema literal from a narrow subset,
because `remix/data-schema` could not describe itself as JSON Schema. `@sdxc/mcp` then carried
its own validator for that subset and a type-level mapper (`FromObjectSchema`) from the literal
to the handler's argument type.

`@sdxc/json-schema` removed the constraint that decision rested on: its combinators validate by
delegating to `remix/data-schema` and describe themselves as JSON Schema 2020-12. The repo had
two schema dialects for no remaining reason — data-schema chains for HTTP, JSON Schema literals
for tools — and tool arguments had no `.refine()`, `.transform()` or coercion.

## Context

| Part of `@sdxc/mcp` before | What it did                                              |
| -------------------------- | -------------------------------------------------------- |
| `schema.ts`                | The JSON Schema subset as types, plus `FromObjectSchema` |
| `validate.ts`              | A hand-written validator for that subset                 |
| `ToolDefinition.input`     | A literal published verbatim in `tools/list`             |

Behaviors the subset validator guaranteed, which tool callers (language models) depend on:
unknown properties dropped, `null` treated as absent, defaults substituted, every issue reported
at once, and no coercion of `"20"` to `20`.

## Decision

A tool's `input` and optional `output` are `@sdxc/json-schema` schemas whose parse yields an
object (`ToolSchema`). One schema still has three consumers:

1. **The wire.** `tool()` publishes `toJSONSchema(input, { direction: "input", refs: "inline" })`
   as `inputSchema`, and the output side of `output` as `outputSchema`. `$schema` is dropped,
   since 2020-12 is MCP's default dialect; named schemas stay inline, since a model reads one
   self-contained object more reliably than it follows `$ref`s.
2. **The validator.** `tools/call` parses the arguments with the schema itself, so `ctx.input` is
   the parse output — defaults applied, transforms run.
3. **The type.** A handler's `ctx.input` is `InferOutput<typeof input>`.

`tool()` throws at declaration when a schema has no JSON Schema form, or its root is not
`type: "object"` (a root union or nullable), matching how an invalid tool name already fails.

The model-facing behaviors are kept: `s.object` strips unknown keys and collects every issue;
`s.defaulted` substitutes; `s.integer()` rejects `"20"`. `null` is removed before parsing for
any property whose published schema admits no `null`, walking nested objects and array items,
so `s.nullable` still receives it. An issue for a property absent from the arguments reads
`Required`, since data-schema's type message would suggest a wrong value was sent.

The subset restriction is dropped. Anything `@sdxc/json-schema` describes is allowed inside the
root object; ADR-036's advice to keep arguments to scalars, enums and arrays stays as guidance in
the package README.

## Consequences

### Positive

- One schema dialect across HTTP handlers, OpenAPI documents and MCP tools; an operation's own
  schemas can become a tool's input without translation.
- Tool arguments gain checks, refinements, transforms and coercion.
- `schema.ts` and the hand-written validator are gone, along with the type-level mapper.

### Negative

- Issue messages are data-schema's (`Expected integer`) rather than the subset's own wording.
- A `.refine()` validates without documenting itself, so a model can hit a constraint the
  published schema does not show; describe it with `.meta({ description })`.

### Neutral

- `Tool.inputSchema` is now `Tool.input`, and `validateArguments` takes the tool, since
  null-handling reads the published JSON Schema alongside the schema that parses.
- The output schema is published but results are not validated against it.

## References

- [ADR-036: Model Context Protocol Server Package](./ADR-036-model-context-protocol-server-package.md)
- [`@sdxc/json-schema` README](../../packages/json-schema/README.md)
- [`@sdxc/mcp` README](../../packages/mcp/README.md)
