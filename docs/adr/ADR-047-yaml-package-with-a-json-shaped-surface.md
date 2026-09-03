# ADR-047: YAML Package With a JSON-Shaped Surface

## Status

**Implemented** - 2026-09-03

## Background

ADR-046 replaced the `yaml` dependency with a frontmatter parser living inside
`@pkg/markdown`. It weighed extracting a package and rejected it, on the grounds that
nothing else in the repository parses YAML and that a package invites the general
implementation the ADR existed to remove.

That reasoning was wrong on the point that matters. A parser that only one caller can
reach, under a name that describes that caller's use of it rather than the format it
reads, is not a smaller decision than a package — it is the same code with a worse
address. YAML in this repository is a format, not a markdown detail: it is what
`wrangler.jsonc`'s neighbours are written in, what a CI file is, and what any future
config reader would reach for. And the half ADR-046 never considered — writing YAML —
has no home at all inside a markdown package.

## Context

### What ADR-046 left behind

| Fact                                                              | Consequence                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The parser lived at `packages/markdown/src/server/frontmatter.ts` | A config or CI reader would have to import from a markdown package, or copy it |
| It was named for frontmatter                                      | The name described one caller, not the format                                  |
| It only read                                                      | Nothing in the repository could write YAML without a dependency                |
| It was exported from `@pkg/markdown/server`                       | Reading a YAML file dragged in Markdoc and the highlighter                     |

The last one is the concrete cost: `@pkg/markdown/server` is 180.0 KB minified, and a
caller wanting the parser alone had no way to ask for only that.

### The subset is the asset

The parser covers block mappings and sequences, plain and quoted scalars, flow
collections, literal and folded block scalars, and comments, resolving scalars by the
YAML 1.2 core schema. Anchors, aliases, merge keys, tags, explicit keys and
multi-document sources are failures.

ADR-046 recorded the evidence for that subset: agreement with `yaml` on 138 of 143
recorded cases, the five departures being exactly the declined constructs, plus 3,332
generated documents where the two agreed on every value and 668 where both refused.
That evidence is about the subset, not about where the code sits, so it carries over
whole.

## Decision

The parser becomes `@pkg/yaml`, a package of its own, and gains a serializer. The two
functions are named after their `JSON` counterparts and exported separately:

```typescript
export { parse } from "./lib/parse"; // (source: string) => Result<unknown, YAMLParseError>
export { stringify } from "./lib/stringify"; // (value: unknown, options?: StringifyOptions) => Result<string, YAMLStringifyError>
```

A caller wanting the familiar namespace writes `import * as YAML from "@pkg/yaml"` and
gets `YAML.parse` and `YAML.stringify`; a caller wanting one half writes
`import { parse } from "@pkg/yaml"`. Binding the two into an exported `YAML` object
instead would read the same at the call site and cost 2.9 KB in every bundle that only
parses, because the object references both functions and no bundler can then drop
either.

`JSON` supplies the names; `@pkg/xml` supplies the error handling. `JSON.parse` throws,
and ADR-041 already treated throwing out of a parse the repository calls as a defect, so
both halves answer with a `Result` the way `XML.parse` and `XML.stringify` do.

### Layout

| Module                 | Holds                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `src/index.ts`         | The two functions, the `StringifyOptions` type, and both error classes |
| `src/lib/parse.ts`     | The parser, moved from `@pkg/markdown` unchanged but for its name      |
| `src/lib/stringify.ts` | The serializer                                                         |
| `src/lib/scalars.ts`   | Core-schema scalar resolution, which both halves need                  |
| `src/lib/errors.ts`    | `YAMLParseError` and `YAMLStringifyError`                              |

`resolvePlain` is the module both halves share, and it is what keeps them honest: the
parser reads a plain scalar through it, and the serializer asks it whether a string can
be written unquoted without coming back as a number, a boolean or `null`.

### What the serializer writes

Block style, two-space indentation by default. The notation for each value is whichever
one reads back unchanged: a plain scalar where that is unambiguous, a literal block for
text spanning lines, double quotes otherwise.

Values follow `JSON.stringify` wherever JSON has an answer — `toJSON` is used where a
value has it, an `undefined` object entry is dropped, an `undefined` array entry becomes
`null`, and a function or symbol is treated the same way. Where YAML can say something
JSON cannot, YAML wins: `NaN` and the infinities are written as `.nan`, `.inf` and
`-.inf` rather than flattened to `null`. A circular structure and a `bigint` are
failures, each naming the path to the offending value.

### The round trip is the contract

`parse(stringify(value))` returns the value it started from. It is checked as a property
rather than asserted case by case: 5,000 generated values — every scalar type, strings
that look like other types, strings YAML reads as structure, multi-line text, nested and
empty collections, at three indentation widths — were written and read back, and all
5,000 matched, `NaN` and infinities included.

Comments and the original formatting are not part of a value and do not survive the
trip. The README says so.

### What it weighs

| Entry                      | Minified | Gzipped |
| -------------------------- | -------- | ------- |
| `@pkg/yaml`, both halves   | 11.3 KB  | 4.2 KB  |
| `@pkg/yaml`, `parse` alone | 8.4 KB   | —       |
| `@pkg/markdown/server`     | 180.0 KB | 58.6 KB |

Importing `parse` alone drops the serializer entirely: `Converting circular structure`,
`-.inf` and the rest of its strings are absent from the built bundle. `import * as YAML`
followed by `YAML.parse` builds byte-for-byte the same 8.4 KB, so the namespace form
carries no penalty.

That leaves `@pkg/markdown/server` where ADR-046 left it, at 180.0 KB, with the
serializer it never calls costing it nothing. Against the 277.2 KB it stood at with the
`yaml` library, it is 97.2 KB lighter.

### `@pkg/markdown` becomes a consumer

`Markdown.frontmatter` imports `parse` on its own and keeps its contract unchanged: a block that
fails to parse stands in as `{}`, so the frontmatter schema is what reports the document
as invalid. `parseFrontmatter` and `FrontmatterError` are no longer exported from
`@pkg/markdown/server`; the format is documented in `@pkg/yaml`'s README and linked from
markdown's.

## Consequences

### Positive

- YAML has an address. A config or CI reader imports `@pkg/yaml` rather than reaching
  into a markdown package or copying the parser.
- The repository can write YAML, which it could not do at all before, including from a
  Worker.
- A caller that wants YAML no longer pulls 180 KB of Markdoc and highlighting to get it,
  and pays only for the half it imports.
- The round-trip property is testable, and is the thing that keeps the two halves from
  drifting apart.

### Negative

- One more package to maintain, and a serializer that did not exist to maintain with it.
- The subset now has two implementations to keep in step. `scalars.ts` is the shared
  module that holds the risk down; the round-trip fuzz is what catches it when it does
  not.
- `@pkg/markdown` gains a workspace dependency where it had first-party code.

### Neutral

- The parser is unchanged. Its recorded corpus moved with it and still passes, so the
  evidence in ADR-046 stands without being re-gathered.
- The subset is unchanged too. A standalone package makes supporting anchors and tags
  more defensible, but nothing in the repository needs them, and the failure they return
  names itself.
- `@pkg/highlight` keeps its own YAML grammar. Tokenizing for display and reading for
  value are different jobs on the same syntax.

## Alternatives Considered

### 1. Leave the parser in `@pkg/markdown`

What ADR-046 decided.

**Rejected because**: it names the code after one caller, gives a second caller nowhere
to import from, and has no room for a serializer.

### 2. Ship `parse` only, and add `stringify` when something needs it

Smaller now.

**Rejected because**: the round trip is what pins the parser's own behavior. Written
alone, `parse` is checked against a recorded corpus; written as a pair, every generated
value checks both halves at once, and the serializer's quoting rules are forced to agree
with the parser's reading rules rather than being asserted by hand.

### 3. Throw, the way `JSON.parse` does

The literal reading of "shaped after `JSON`".

**Rejected because**: it would be the only fallible package in the repository that
throws, and ADR-041 fixed exactly that shape as a defect in `@pkg/xml`. What is worth
copying from `JSON` is the pair of names and the absence of a document model, not the
error channel.

### 4. Export a `YAML` object binding both functions

`export const YAML = { parse, stringify }`, so every caller writes `YAML.parse` without
choosing an import form.

**Rejected because**: the object holds a reference to both functions, so a bundle that
only parses still carries the serializer — 2.9 KB minified, measured. Separate exports
give the same call site through `import * as YAML` and let the writer fall away.

### 5. Support the whole of YAML

Anchors, aliases, merge keys and the core tag set, closing the five known departures
from the `yaml` library.

**Rejected because**: nothing in the repository writes them, each adds a resolution pass
the subset does not need, and the failure the parser returns for them names the
construct. The subset can grow later against the same recorded corpus.

## References

- [ADR-046: First-Party Frontmatter Parsing](./ADR-046-first-party-frontmatter-parsing.md)
- [ADR-041: In-Package XML Parsing and Serialization](./ADR-041-in-package-xml-parsing-and-serialization.md)
- [YAML 1.2.2 Core Schema](https://yaml.org/spec/1.2.2/#103-core-schema)

## Current Progress

- [x] Extract `packages/yaml` with the parser, the shared scalar resolution and the errors
- [x] Export `parse` and `stringify` separately, and confirm the serializer is dropped
- [x] Write the serializer and prove the round trip over 5,000 generated values
- [x] Point `@pkg/markdown` at `parse` and drop its own frontmatter exports
- [x] Document the package per `docs/guides/package-documentation.md`
- [x] Add the package to the root README; mark ADR-046 superseded
