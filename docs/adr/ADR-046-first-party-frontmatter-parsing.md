# ADR-046: First-Party Frontmatter Parsing

## Status

**Superseded** by [ADR-047](./ADR-047-yaml-package-with-a-json-shaped-surface.md) - 2026-09-03

The decision to stop depending on the `yaml` library stands, and the evidence gathered
here for the subset carries over. What changed is where the parser lives: ADR-047 moves
it out of `@pkg/markdown` into `@pkg/yaml` and pairs it with a serializer, which makes
this ADR's fourth alternative — extract a `@pkg/yaml` package — the one that was taken.

## Background

`@pkg/markdown/server` extracts a document's frontmatter before handing the body to
Markdoc. `Markdown.frontmatter` slices the text between the opening `---\n` and the next
`\n---\n`, calls `YAML.parse` on it, and validates the result against a Standard Schema.
That single call is the whole of `yaml` in this repository.

ADR-041 removed `@xmldom/xmldom` from `@pkg/xml` and ADR-042 removed `prismjs` from the
markdown and mail pipelines. Both were found by the same question, asked of the packages
that ship inside deployed Workers: is the library carrying its weight for the surface
actually used? `yaml` is the last third-party runtime dependency in the markdown path
that has not been asked.

## Context

### Where it runs

`@pkg/markdown/server` is server-only; no app imports it into a client bundle. It reaches
production through four Workers:

| Worker      | Path                                             | Frontmatter schema                                                           |
| ----------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `uptime`    | `app/services/docs.ts`, 32 bundled docs          | `title`, `description`, `section: { title, order }`, `order`, `lastUpdated?` |
| `blog`      | `app/services/mcp-page.ts`, 2 locale files       | `title`, `description`                                                       |
| `blog`      | `app/http/view-models/post.ts`, post bodies      | `s.object({})`                                                               |
| `books`     | `app/http/controllers/sample.tsx` sample chapter | `s.object({})`                                                               |
| `blog-saas` | `@pkg/blog-engine` tenant markdown fields        | `s.object({})`                                                               |

Parsing happens per request inside workerd, not at build time: the docs and the MCP pages
are loaded through `import.meta.glob(..., { query: "?raw" })` and parsed when a request
asks for one, and tenant markdown arrives from D1.

Only two of those five call sites declare a frontmatter shape at all. The other three pass
an empty schema: their sources carry no frontmatter, and the extraction runs on them only
because it runs on everything.

### What the corpus uses

34 files in this repository carry frontmatter. Across all of them the YAML in use is:

- Block mappings, one level of nesting, indented with two spaces
- Plain (unquoted) scalars, including ones containing `&`, `'` and `.`
- Integers (`order: 3`)
- One ISO date-shaped value, `lastUpdated: 2026-08-02`

No file uses a quoted scalar, a sequence, a flow collection, a block scalar, a comment, an
anchor, an alias, a tag, or a second document. `yaml` runs at its default YAML 1.2 core
schema, where `2026-08-02` resolves to the string `"2026-08-02"` — which is what
`s.optional(s.string())` in `docs.ts` is written against.

### What it costs the Workers that carry it

Measured with `bun build --minify --target=browser` over `@pkg/markdown/server`, once
whole and once with `yaml` external:

| Entry                  | With     | Without  | `yaml`'s share              |
| ---------------------- | -------- | -------- | --------------------------- |
| `@pkg/markdown/server` | 277.2 KB | 171.6 KB | 105.6 KB min / 31.6 KB gzip |

Gzipped, 87.4 KB against 55.8 KB. `yaml` is 38% of the minified bytes of the module whose
job is Markdoc, and it is there to read mappings of strings and integers.

Importing the named `parse` rather than the default export recovers 5.8 KB minified,
1.6 KB gzipped, out of 105.6 KB: the document model, the stringifier, the schema
machinery for YAML 1.1 and JSON, anchors, tags, and error recovery all come along either
way. There is no smaller entry point into the library.

### The library itself

`yaml@2.9.0` is healthy: ISC, zero dependencies, published 2026-05-11, with `3.0.0-1` on
the `next` tag. Nothing here is a complaint about the package. The mismatch is that a
0.69 MB, 103-version general YAML implementation — a document model, `stringify`, YAML 1.1
compatibility, anchors, tags, merge keys, custom schemas — serves a call site that reads
five keys off a mapping.

### Behavior to preserve

`Markdown.frontmatter` today:

1. Strips nothing unless the source starts with `---\n` and a `\n---\n` follows.
2. Feeds the slice between them to `YAML.parse`.
3. Substitutes `{}` when the parse throws, and when it returns `null` (an empty block).
4. Hands whatever came back to the schema, which decides whether the document is valid.

Step 3 matters for the three call sites with an empty schema: `@pkg/blog-engine` renders
tenant-authored markdown, where a document opening on two thematic breaks is already
swallowed as frontmatter and must keep rendering rather than start failing. Step 4 is
where a docs author's typo surfaces — as a Standard Schema issue naming the missing key,
not as a YAML error.

## Decision

`@pkg/markdown` parses frontmatter in its own code. `yaml` is removed from its
dependencies.

### The parser

A new module, `packages/markdown/src/server/frontmatter.ts`, exports a single function:

```typescript
/**
 * Parses a frontmatter block into the value its schema will validate.
 *
 * @param source - The text between the document's `---` delimiters
 * @returns The parsed value, or a failure when the source falls outside the
 * supported subset
 */
export function parseFrontmatter(source: string): Result<unknown, FrontmatterError>;
```

`Markdown.frontmatter` calls it in place of `YAML.parse` and keeps its own contract
unchanged: a failure becomes `{}`, and the schema still decides whether the document is
valid.

### The supported subset

Resolution follows the YAML 1.2 core schema, so values match what `yaml` returned:

| Supported                                                               | Example                   |
| ----------------------------------------------------------------------- | ------------------------- |
| Block mappings, nested by space indentation                             | `section:` / `  order: 1` |
| Block sequences of scalars, mappings or sequences                       | `tags:` / `  - remix`     |
| Plain scalars, folded when written across lines                         | `title: Team & Settings`  |
| Single- and double-quoted scalars, with escapes                         | `title: "a: b"`           |
| Flow sequences and mappings, which may span lines                       | `tags: [remix, workers]`  |
| Literal and folded block scalars, with chomping and an indent indicator | `description: >-`         |
| Comments, whole-line and trailing                                       | `order: 1 # first`        |
| `null` (`null`, `~`, empty), booleans, integers, floats                 | `lastUpdated:`            |
| Everything else scalar-shaped resolves to a string                      | `lastUpdated: 2026-08-02` |

Outside the subset, and reported as a failure rather than guessed at: anchors, aliases and
merge keys; tags; explicit keys (`? `); quoted values spanning lines; multi-document
sources; tab indentation. A plain scalar opening on a character YAML reserves — `@`,
`` ` ``, `%`, `,`, `]`, `}` — is a failure too, as it is in YAML. The README states this
list, so the boundary is a documented contract rather than something an author discovers
by writing a doc that renders blank.

### Proving equivalence

The dependency came out only after the replacement was shown to agree with it. Following
ADR-041, the evidence is recorded behavior rather than a reading of the code, gathered
while `yaml` was still installed:

1. `YAML.parse` output was recorded for all 34 frontmatter blocks in the repository and
   for 109 synthetic cases covering every row of the subset table, every construct on the
   unsupported list, and the malformed inputs that reach the `{}` fallback. The new parser
   agrees on 138 of those 143, the five departures being the constructs it declines:
   anchors, aliases through a merge key, tags, explicit keys, and a quoted value spanning
   lines. `yaml` reads all five; this parser fails them, so they reach the schema as `{}`.
2. A generator built 4,000 further documents out of the same constructs. `yaml` accepted
   3,332 of them and the parser matched its value on every one; `yaml` rejected the other
   668 and the parser rejected all 668 as well. No document parsed here that `yaml`
   refused.
3. The corpus is committed as `packages/markdown/src/server/frontmatter.test.ts`, stating
   the recorded values as assertions.

### What it cost to carry

Re-measuring `@pkg/markdown/server` the same way:

| Entry                  | Before   | After    | Recovered                  |
| ---------------------- | -------- | -------- | -------------------------- |
| `@pkg/markdown/server` | 277.2 KB | 180.0 KB | 94.9 KB min / 28.2 KB gzip |

The parser is 8.4 KB minified, 2.8 KB gzipped, against the 171.6 KB `yaml`-external
measurement. That misses the 5 KB bar this ADR set for it: the bar was written before the
subset was, and block scalars, flow collections and multi-line plain scalars each cost
more than a mapping reader would. The subset is what the README documents, so trimming it
to reach the bar would trade a stated contract for 3 KB.

### Documentation

- `packages/markdown/README.md` carries the subset table and the unsupported list.
- The root `README.md` dependency table no longer has a `yaml` row.

## Consequences

### Positive

- 94.9 KB minified, 28.2 KB gzipped, left the SSR bundle of `blog`, `books`, `uptime`
  and `blog-saas`.
- The frontmatter format is a stated contract with a test corpus behind it, where it was
  "whatever `yaml@2.x` happens to accept".
- The markdown path reaches zero third-party runtime dependencies beyond Markdoc itself,
  finishing what ADR-041 and ADR-042 started.

### Negative

- Frontmatter parsing is this repository's to maintain. The 34 recorded blocks, the 109
  synthetic cases and the 4,000 generated documents are the guard against that cost
  arriving as a surprise.
- An author reaching for one of the five declined constructs gets `{}` and a schema issue,
  where `yaml` would have parsed it. Anchors and merge keys in a docs frontmatter are the
  plausible case, and none of the 34 files uses them.
- Upstream YAML fixes stop arriving for free.

### Neutral

- The `{}` fallback stays. Surfacing a parse failure would be the tidier contract, but
  `@pkg/blog-engine` validates tenant markdown against an empty schema, so a failure there
  would turn an accidental `---` fence into a broken page rather than a swallowed one.
- Values are unchanged for every file in the repository, `lastUpdated` included, because
  the subset resolves scalars by the same YAML 1.2 core schema `yaml` defaults to.
- A key spelled `__proto__` becomes an own property rather than reaching the prototype,
  which is what `yaml` did and what assigning it would not have.
- `@pkg/highlight` keeps its own YAML grammar. It tokenizes for display and shares nothing
  with this parser; the two have different jobs on the same syntax.

## Alternatives Considered

### 1. Keep `yaml` and import `parse` by name

The smallest possible change.

**Rejected because**: it recovers 5.8 KB of 105.6 KB. The document model and the
stringifier are reachable from `parse` and come along regardless.

### 2. Parse frontmatter at build time with a Vite plugin

The docs and MCP pages are bundled sources, so a plugin could hand the Worker parsed
objects and keep YAML out of the runtime entirely.

**Rejected because**: it splits the pipeline in two. `@pkg/blog-engine` parses tenant
markdown out of D1 at request time and cannot be served by a build step, so `yaml` would
still ship in `blog-saas` while three other apps took a different path to the same result.

### 3. Move frontmatter out of YAML

TOML or JSON frontmatter would need a parser too — `JSON.parse` for the latter, free.

**Rejected because**: it rewrites 34 authored files and makes this repository's markdown
incompatible with every other tool that reads frontmatter, to save a parser that the
subset above makes small anyway.

### 4. Extract a `@pkg/yaml` package

A general YAML package, with `@pkg/markdown` as its first consumer.

**Rejected because**: nothing else in the repository parses YAML, and the value of the
subset is that it is small enough to state on one page. A package invites the general
implementation this ADR exists to remove.

## References

- [ADR-041: In-Package XML Parsing and Serialization](./ADR-041-in-package-xml-parsing-and-serialization.md)
- [ADR-042: First-Party Syntax Highlighting](./ADR-042-first-party-syntax-highlighting.md)
- [YAML 1.2.2 Core Schema](https://yaml.org/spec/1.2.2/#103-core-schema)

## Current Progress

- [x] Record the 34-block corpus and the synthetic set against `YAML.parse`
- [x] Implement `parseFrontmatter` and its test corpus
- [x] Switch `Markdown.frontmatter` over and drop the `yaml` dependency
- [x] Re-measure the bundle: 180.0 KB, 8.4 KB over the 171.6 KB `yaml`-external mark
- [x] Document the subset in `packages/markdown/README.md`; drop the root README row
