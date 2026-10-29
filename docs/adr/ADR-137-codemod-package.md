# ADR-137: `@sdxc/codemod` Package

## Status

**Accepted** - 2026-10-15

> Superseded by [ADR-183](./ADR-183-drop-sdxc-umbrella.md) for import spelling: prefer `@sdxc/*`.
> Codemod fixtures may still show fictional `sdxc/` rewrite targets.

## Background

The `sdxc` CLI edits import declarations in a consumer's project: `sdxc ui add` (ADR-141) points
every import of a component at the app's copy, splitting `import { Button, Dialog } from "sdxc/ui"`
when only Button was copied; `remove` reverses it; `update` re-applies it to a fresh copy. The
release build rewrites the specifiers of every `@sdxc/ui` component as it writes the component
registry. `sdxc make` (ADR-143) declares what it generates in `app/jobs/index.ts`, a route contract or the
MCP declaration modules, and maps it in the matching initializer.

The repo already finds module specifiers in three places, each with its own regular expressions:
`test/import-extensions.ts`, `scripts/release/build.ts` (`checkDistSpecifiers`) and
`packages/well-known/src/dependencies.test.ts`. A pattern over source text matches inside JSX
text (`<p>Don't import "./x.js"</p>`), template literals and comments, which is tolerable for a
check and wrong for an edit.

## Context

### What the edits need from a parser

None of the edits needs a syntax tree of the whole program. They need:

- tokens with exact source ranges, so strings, template literals, regular expressions, comments
  and JSX text are never read as code;
- matched brackets;
- import and `export … from` declarations, which ECMAScript modules allow only at the top level;
- dynamic `import("…")` and calls to named callees (`vi.mock("…")`) anywhere;
- the object literal passed to a named call, and its properties;
- where a statement ends.

### Where the difficulty is

The structure above is small once tokens are right. Tokenizing JavaScript, TypeScript and JSX
correctly is the hard part:

| Ambiguity                          | Example                                     |
| ---------------------------------- | ------------------------------------------- |
| Regular expression or division     | `if (x) /re/.test(y)` against `a / b`       |
| Block or object literal before `/` | `} /re/` after a block, `} / 2` after `{…}` |
| Template literal nesting           | `` `a ${ `b ${c}` } d` ``                   |
| JSX or comparison                  | `<p>Don't</p>` against `a < b`              |
| JSX or generic arrow in `.tsx`     | `<T,>(x: T) => x`                           |
| Type arguments or comparison       | `f<T>(x)` against `a < b > c`               |
| Arrow body or object literal       | `() => {}` then `/re/` against `({}) / 2`   |

`es-module-lexer` resolves the first three for JavaScript in about 1,500 lines of C; it has no
TypeScript or JSX support.

### Who runs the edits

Every caller runs on Node or Bun: the CLI on a developer's machine, the release build, and the
repo's own tests. A consumer installs `@sdxc/codemod` once, through `sdxc`, which every project
built on the packages depends on, so its install size lands in every one of those projects.

### Checking a hand-written scanner

`oxc-parser`, a Rust parser the workspace already installs through Vite+, reports every static
import, re-export and dynamic `import()` with its source range. A probe over a `.tsx` file with an
apostrophe in JSX text and a commented-out import returned exactly the real specifiers. The repo
holds 8,048 JavaScript and TypeScript source files, a corpus a scanner can be compared on.

## Decision

Add `@sdxc/codemod`, a library of source-to-source edits over JavaScript and TypeScript (`.js`,
`.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`, `.mts`, `.cts`) built on its own scanner, with no runtime dependency beyond
`@sdxc/result`. Every edit scans the input, computes replacements by source range, and returns the
new text, so only the replaced ranges change and a file keeps its formatting, comments and quote
style.

### Scanner

- **Tokenizer.** Produces identifiers, keywords, punctuators, numbers, strings, template parts,
  regular expressions, comments and, in every extension but `.ts`, `.mts` and `.cts`, JSX
  tokens, each with its range.
  - A `/` begins a regular expression when the previous significant token admits an expression:
    an operator, `(`, `[`, `{`, `,`, `;`, `:`, `?`, `=>`, an expression keyword (`return`,
    `typeof`, `in`, `of`, `new`, `delete`, `void`, `throw`, `case`, `do`, `else`, `yield`,
    `await`) or the start of input. After `)` it does when the parenthesis closed an `if`,
    `while`, `for` or `with` head; after `}` when the brace closed a block. A stack records what
    each open bracket belongs to.
  - A template literal's `${` pushes onto the same stack and its `}` returns to the template.
  - In `.js`, `.mjs`, `.cjs`, `.jsx` and `.tsx`, a `<` in a position that admits an expression
    begins JSX, except a generic arrow head (`<T,>` or `<T extends …>`). A `<` after an identifier, `)` or `]` is an
    operator or opens type arguments; type arguments are skipped as a balanced `<…>` group when
    the group is followed by `(` or a template literal, and read as comparisons otherwise.
  - A `}` that closes an arrow function's block body or a statement block ends a statement, so a
    `/` after it begins a regular expression; a `}` that closes an object literal ends an
    expression. The bracket stack records which one each `{` opened, from the token before it. Inside JSX, text runs to `{` or `<`,
    attribute strings have no escapes, and `{…}` returns to code. In `.ts`, `.mts` and `.cts`, `<`
    never begins JSX.
  - JSX is read in every JavaScript extension, decided by the extension alone: React-style
    projects keep components in `.js`, and in plain JavaScript a `<` where an
    expression begins is a syntax error, so reading it as JSX changes no valid program. The
    oracle parses those files as JSX for the same reason.
- **Structure.** Over the tokens: bracket matching, top-level import and export declarations with
  their bound names, `import(…)` and listed calls anywhere, object literals and their properties,
  and statement ends.
- **Fails closed.** Input that ends inside a string, template, regular expression, comment or JSX
  element, unbalanced brackets, or an import declaration that does not match the grammar is a
  failure, and no edit is computed from it.

### Module references

```ts
import { findModuleReferences, moveImports, rewriteSpecifiers } from "@sdxc/codemod";

let references = findModuleReferences("page.tsx", source, { calls: ["vi.mock"] });

let rewritten = rewriteSpecifiers("dialog.tsx", source, (reference) =>
	reference.specifier.startsWith("@sdxc/") ? reference.specifier.replace("@sdxc/", "sdxc/") : null,
);

let moved = moveImports("page.tsx", source, {
	from: "sdxc/ui",
	names: ["Button"],
	to: "~/components/ui/button.js",
});
```

- **`findModuleReferences`** returns every static import, re-export, side-effect import and
  dynamic `import()` with a string literal, plus the first argument of each call whose callee is
  listed in `calls`. A reference carries its specifier, kind, whether it is type-only, the names it
  binds, and its source range.
- **`rewriteSpecifiers`** replaces the specifier of every reference the callback maps to a new
  string and keeps the original quote character; `null` leaves a reference untouched.
- **`moveImports`** moves imports and re-exports from one specifier to another, matching each
  binding by the name the module exports: a named binding by its name, a default by
  `"default"`, and a namespace import, `export * as X` or bare `export *` by `"*"`, which
  repoints the whole declaration. When every binding of a declaration moves, its specifier is
  replaced in place; otherwise the declaration keeps the rest, with aliases, `type` modifiers and
  the original quote and semicolon style carried to `to`.
  - Every moved binding of one kind (import or re-export, type-only or not) lands in one
    declaration of `to`: an existing one, else the first declaration repointed in place, else
    one new declaration after the first that keeps names. Two declarations that both move
    become one, so `to` is never named twice for one kind.
  - A default joins the named imports (`import Ui, { Button }`). A namespace, a type-only default
    and a second default keep declarations of their own, the shapes the grammar and TypeScript's
    `import type` admit. `import type` stays a separate declaration from `import`, the repo's
    convention for type imports.
  - A namespace import or `export *` of `from` that stays while other names move reaches them
    through the whole module, and comes back as unhandled for the caller to report.

### Insertions

```ts
import { addProperty, insertAfterLast } from "@sdxc/codemod";

let declared = addProperty("index.ts", source, {
	call: "jobs",
	path: ["trials"],
	key: "expire",
	value: "job({ input: s.object({}) })",
});

let mapped = insertAfterLast("dispatcher.ts", source, {
	call: "dispatcher.map",
	statement: 'dispatcher.map(jobs.trials.expire, () => import("~/app/jobs/trials/expire"));',
	fallbackAfter: "createJobDispatcher",
});
```

- **`addProperty`** finds the object literal passed as the first argument of the named call
  (`jobs`, `route`, `tools`, `resources`), walks `path` through nested object literals (or the
  object argument of a nested `route("/prefix", { … })`), creating a missing level, and appends
  `key: value` after the last property with the indentation and trailing-comma style of its
  siblings. An existing `key` is a failure.
- **`insertAfterLast`** places a statement after the last statement that calls `call`, in the
  same block and at the same indentation, so a router factory's `router.map` calls and a
  module-level `webRouter.map` sequence both grow in place. With no such call, it places the
  statement after the declaration whose initializer calls `fallbackAfter`; with neither, it fails.

Callers pass `value` and `statement` as source text, which the package indents to match its
neighbours and otherwise inserts verbatim.

Each edit answers `Result<Edit, Error>`, where `Edit` holds the new `source`, whether anything
`changed`, and, for reference edits, the `unhandled` references. A failure names what was not
found or could not be scanned, which the CLI turns into the printed fallback instructions.

### Verification

- **Oracle test.** `oxc-parser` is a development dependency only. A test scans every source file
  in the repo with both and fails on any difference in the specifiers found, their kinds or their
  ranges.
- **Ambiguity fixtures.** A fixture file per row of the ambiguity table, plus the import forms the
  repo does not use yet, runs through the same comparison, since the repo's own code exercises
  few of them.
- **Exact-output fixtures for every edit.** Each of `rewriteSpecifiers`, `moveImports`,
  `addProperty` and `insertAfterLast` has input and expected-output fixtures compared byte for
  byte, covering the shapes the CLI meets: nested `route()` groups, a missing nesting level,
  trailing commas present and absent, tabs and spaces, `router.map` inside a factory and at
  module level, aliases and `type` modifiers on moved names, default and namespace
  imports and `export *`, and declarations that merge into one. An edit that lands in the wrong
  object or the wrong block fails here even when the result still parses.
- **Edits re-scan.** Every edit test also scans its output again and parses it with
  `oxc-parser`, so an edit that produces invalid code fails.

## Consequences

### Positive

- **Edits that understand the syntax.** JSX text, strings, template literals and comments are
  never mistaken for imports.
- **Formatting survives.** Only the replaced ranges change.
- **No native dependency.** The package installs as plain JavaScript, small enough to ride in
  every `sdxc` install, and runs on any JavaScript runtime.
- **One specifier finder for the repo.** `scripts/release/build.ts`, `test/import-extensions.ts`
  and the `@sdxc/well-known` dependency test can move to `findModuleReferences` and drop their
  patterns.

### Negative

- **The scanner is ours to maintain.** New syntax that changes tokenization, or new import forms
  (`import defer`, `import source`), needs a change; upgrading `oxc-parser` in the oracle test is
  where a gap shows first.
- **A misread that stays balanced is not caught at runtime.** Failing closed catches a scanner
  that loses its place; one that classifies a token wrongly and still balances its brackets would
  report a wrong reference. The oracle test and the fixtures are what guard against it.
- **Inserted code is not formatted** to the project's formatter settings beyond copying the
  surrounding quote, semicolon and indentation style; the project's formatter runs after.

## Alternatives Considered

### 1. `oxc-parser` at runtime

A complete, specification-accurate parser written in Rust, already installed through Vite+.

**Rejected because**: every project that installs `sdxc` would install it too, a platform-specific
native binary or a multi-megabyte WebAssembly build, for edits that read import declarations and
a few object literals; the full syntax tree it builds is far more than those edits use. It stays
as the test oracle.

### 2. Regular expressions over source text

**Rejected because**: they match inside JSX text, strings and comments, which a check survives
and an edit does not.

### 3. The TypeScript compiler API

**Rejected because**: `typescript` is several megabytes, and many consumer projects install it
only as a development dependency.

### 4. `es-module-lexer`

**Rejected because**: it targets JavaScript; TypeScript and JSX input would need a transform
first, which loses the source ranges an edit needs, and it reports no bound names for
`moveImports`.

### 5. jscodeshift or recast

**Rejected because**: printing a modified syntax tree reformats more than the edited ranges, and
both bring a Babel parser stack for a task that needs specifier ranges.

## References

- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-141: `sdxc ui` Component Vendoring](./ADR-141-sdxc-ui-component-vendoring.md)
- [ADR-143: `sdxc make` Generators](./ADR-143-sdxc-make-generators.md)
- [`oxc-parser` on npm](https://www.npmjs.com/package/oxc-parser)
- [`es-module-lexer` on GitHub](https://github.com/guybedford/es-module-lexer)

## Current Progress

- [x] Tokenizer and structure, with the oracle test and the ambiguity fixtures
- [x] `findModuleReferences`, `rewriteSpecifiers`, `moveImports`
- [x] `addProperty`, `insertAfterLast`
- [x] Exact-output fixtures for every edit
- [x] Release build and repo tests moved to `findModuleReferences`
- [x] JSX read in `.js`, `.mjs` and `.cjs`, with ambiguity fixtures for JSX against `<` in each
- [x] `moveImports` moves default imports (`"default"`), namespace imports and `export *` (`"*"`)
- [x] `moveImports` merges the moved bindings of one kind into one declaration of `to`
