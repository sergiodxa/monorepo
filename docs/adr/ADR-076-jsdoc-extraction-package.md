# ADR-076: JSDoc Extraction Package

## Status

**Implemented** - 2026-09-21

## Background

Every package in this monorepo documents its exports with JSDoc, enforced by the
documentation rules in `AGENTS.md`: a module header on every file, a comment on
every exported symbol, and a comment that states the why. That is a large body of
written documentation with no way to read it back — a documentation site would have
to re-read the sources itself, or the packages would ship API references maintained
by hand alongside their READMEs.

The need is a documentation site generated from the comments that already exist:
the same thing TypeDoc produces for a TypeScript project, but as data this repo's
own sites can render rather than as HTML a third-party tool lays out.

## Context

### Current State

Package documentation lives in two places that never meet. READMEs are written by
hand against the guidelines in `docs/guides/package-documentation.md`, and JSDoc
lives in the sources, where it reaches an editor's tooltip and nothing else.

### Constraints

| Constraint                      | Consequence                                                      |
| ------------------------------- | ---------------------------------------------------------------- |
| Packages are app-agnostic       | The package cannot decide which files a site documents           |
| Sites run on Cloudflare Workers | A file-system walk is not available where the output is rendered |
| Sources are `.ts` and `.tsx`    | The parser must handle TypeScript syntax and JSX                 |
| Comments carry the meaning      | Tag handling has to be faithful, not best-effort                 |

### Requirements

1. Read JSDoc into structured data, including block tags, their types and their subjects
2. Report what each export is, along with its signature
3. Produce JSON stable enough for a site to render directly

## Decision

Add `@sdxc/jsdoc`: a pure function from source text to a documentation module.

### The extractor is side-effect free

`extract(source, options)` takes the contents of one file as a string and returns a
`DocModule`. It reads no files, resolves no imports and runs no type checker. The
caller decides which files belong in the documentation, reads them, and passes them
in one at a time.

```typescript
let result = extract(await readFile(path, "utf8"), { path });
if (isFailure(result)) throw result.error;
```

This is what keeps the package app-agnostic: file selection is a policy decision
that differs between a package site, an app site and a test, so it stays with the
caller. It also means the extractor runs anywhere, including inside a Worker, and
that the same input always produces the same output.

### Types are the annotations their authors wrote

Without a type checker there is no type resolution, so a parameter typed
`Promise<Entry>` is reported as `Promise<Entry>`, and a symbol whose type is left to
inference reports `null`. For a documentation site this is the better of the two
outputs: a reader recognizes the annotation from the source, and an expanded
structural type is usually unreadable.

Where a JavaScript file carries its types in JSDoc instead, the `@param {T}` and
`@returns {T}` tags fill the same fields, so a `.js` source documents as well as a
typed one.

### Cross-module resolution is the caller's

A barrel that only re-exports produces no symbols. Its `export … from` lines arrive
as `reExports` entries naming the module, the source name and the published name.
A caller that holds every extracted module resolves them; one that does not still
gets an honest answer about what the file contains.

### The document is a uniform tree

A `DocNode` describes a symbol of any kind, and members of classes, interfaces,
enums and namespaces are `DocNode`s under `children`. One recursive renderer covers
the whole document, and `DocProject` wraps the modules with a `schema` number that
rises when a field changes meaning.

### Comment parsing is its own surface

`parseComment` is exported on its own, along with `findTag`, `findTags` and
`inlineLinks`. Aliases collapse (`@arg` and `@argument` become `param`, `@return`
becomes `returns`) so a renderer matches one name per concept, and a fenced code
block inside an `@example` keeps its own tags instead of ending the example.

### Members declared private stay out

A member written `private` or with a `#name` is implementation, so it never reaches
the model. A symbol tagged `@internal` is dropped by default, with everything nested
under it, and `includeInternal` brings both back for a caller documenting internals.

## Consequences

### Positive

- **The comments already written become a product**: 4,081 of the 4,195 exported
  symbols across `packages/` and `apps/` carry a comment the extractor reads
- **Renders anywhere**: with no file system and no compiler host reaching disk, the
  extraction step can run in a build, a test or a Worker
- **Deterministic output**: the same text always produces the same document, so a
  generated `api.json` diffs meaningfully
- **Testable without fixtures on disk**: every test passes source as a string

### Negative

- **No resolved types**: an exported symbol with an inferred return type documents
  as `null`, so authors who want a type published must write the annotation
- **No cross-file knowledge**: a site that follows `reExports` has to hold every
  target module, and one that does not shows a barrel as empty
- **Carries the TypeScript parser**: the compiler package is a peer dependency,
  which is heavy for what amounts to a parse

### Neutral

- **Overloads merge into one symbol**: a symbol with several signatures keeps a
  comment per signature, and a symbol with one documents itself
- **The package stays private**: its surface will move while the first site is built
  against it

## Alternatives Considered

### 1. TypeDoc

Run TypeDoc and render its JSON output.

**Rejected because**: it owns file discovery, the compiler program and the entry
point layout, none of which survive in a Worker, and its model is shaped around the
site it generates rather than the one this repo would build.

### 2. Extraction through a `ts.Program` and type checker

Build a program over the package's entry points and read resolved types from the
checker, which is how TypeDoc works.

**Rejected because**: a program reads from disk and follows imports, which makes the
package decide what a site documents and ties it to a file layout. Resolved types
also print worse than the annotations authors wrote.

### 3. A comment parser with no syntax awareness

Scan for `/** … */` blocks and the line that follows each one.

**Rejected because**: the signature, the members of a class and the modifiers on
them are half of what a reference page shows, and recovering them from text is a
worse parser than the one already available.

### 4. Shipping a CLI

Provide a command that walks a directory and writes `api.json`.

**Rejected because**: the walk is the policy decision the package is avoiding. A
caller writes the loop it wants in a few lines, and keeping the package a library
keeps it usable where a command is not.

## References

- [JSDoc block tags](https://jsdoc.app/)
- [TypeDoc](https://typedoc.org)
- [ADR-001: New Package Extraction](./ADR-001-new-package-extraction.md)
- [ADR-017: README Package Description Source of Truth](./ADR-017-readme-package-description-source-of-truth.md)

## Notes

- The file extension in `options.path` selects the dialect, so `.tsx` source passed
  without a path fails on its first JSX element
- Syntax errors come back as an `ExtractError` carrying every diagnostic with a
  1-based line and column, read through a compiler host that answers only from memory
- A file's leading comment is claimed for the module when a blank line or a second
  block separates it from the first declaration, which is the header style
  `AGENTS.md` mandates
- Constructor parameter properties are documented as members, since nothing in the
  class body names them
