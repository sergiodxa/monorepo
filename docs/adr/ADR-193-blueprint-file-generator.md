# ADR-193: `@sdxc/blueprint`, a File Generator Built on Stubs

## Status

**Accepted** - 2026-11-09

## Background

`sdxc make` writes an app's controllers, jobs, models and the rest from `.stub` files shipped in
`@sdxc/kit`, and an app overrides any of them by keeping a stub of the same name in its
`make.stubs` folder. That covers every kind the kit knows. An app also has files of its own that
repeat: a feature flag module, a landing section, a translation file per locale, a fixture. Today
those are copied by hand, and an app that does not use `@sdxc/kit` has no generator at all.

Tools like Hygen solve this with templates that hold arbitrary JavaScript (EJS) and front matter
actions that edit other files. This ADR moves the stub format out of the kit into a package any
project can use, with a command line of its own, and keeps the format small enough to stay a
template rather than a program.

## Context

### What the kit owns today

| Part                                     | Where                              | Generic? |
| ---------------------------------------- | ---------------------------------- | -------- |
| Stub lookup, project folder first        | `packages/kit/src/make/stubs.ts`   | Yes      |
| `{{placeholder}}` rendering, strict      | `packages/kit/src/make/stubs.ts`   | Yes      |
| Multi-line values keep their indentation | `packages/kit/src/make/stubs.ts`   | Yes      |
| Kinds, folders, variants                 | `packages/kit/src/make/kinds.ts`   | No       |
| Declaring and mapping into index files   | `declare.ts`, `mount.ts` (codemod) | No       |
| Migration numbering, schema diff         | `migrations.ts`, `schema-diff.ts`  | No       |

About 150 of the roughly 9,500 lines behind `sdxc make` are generic. The package's value is less
what it takes out of the kit than what it gives every other project.

### Constraints

- A stub stays plain text with placeholders: no expressions, no code. A placeholder a stub uses
  and the caller does not define is an error naming the stub and what it accepts, as it is today.
- Generated paths cannot depend on file names on disk: `|` is not a legal character in a
  Windows file name, so a filter in a path has to live inside the file.
- `@sdxc/cli` declares every flag in a contract, while a blueprint's values come from its stubs.

## Decision

Add `@sdxc/blueprint`: a library that parses, renders and writes `.stub` files, and an
`sdxc-blueprint` command line that applies an app's own blueprints by convention.

### The stub format

A stub is text with an optional YAML front matter block.

```text
---
to: app/flags/{{name | kebab}}.ts
description: A feature flag with its default
---
/**
 * The {{name | humanize}} flag.
 */
export const {{name | snake | upper}} = flag("{{name | kebab}}", { default: false });
{{#if beta}}
export const {{name | pascal}}Beta = true;
{{/if}}
{{#each variants}}
export const {{item | snake | upper}} = "{{item | kebab}}";
{{/each}}
```

- **Placeholders** are `{{name}}`, with filters chained by pipes: `{{name | plural | camel}}`.
  Filters take no arguments, so the grammar is a name and pipes. A `{{` that does not form a tag
  (`values={{}}`) is text, and `\{{` writes a literal `{{`.
- **Filters** come from `@sdxc/strings`: `camel`, `pascal`, `kebab`, `snake`, `plural`,
  `singular`, `humanize`, `title`, `slug`, plus `upper`, `lower`, `upperFirst`, `lowerFirst` and
  `base` (the last `/` segment). Case filters apply to each `/` segment, so `users/show-page`
  pascal-cases to `Users/ShowPage`. A caller adds its own through `render`'s options.
- **`{{#if name}}…{{/if}}`** writes its body when the value is `true`, a non-empty string or a
  non-empty list. No operators, no `else`.
- **`{{#each name}}…{{/each}}`** writes its body once per item of a list, with `{{item}}` holding
  the current one. An `each` cannot hold another `each`.
- **A block tag alone on its line** removes the whole line, so blocks leave no blank lines behind.
- **A multi-line value** standing alone on an indented line takes that indentation on every line.
- **Strict**: an unknown placeholder, an unknown filter, a list where text belongs or an unclosed
  block is an error naming the stub and the line.

### The library

Documented as a namespace import:

```ts
import * as blueprint from "@sdxc/blueprint";
import * as s from "remix/data-schema";

let stub = blueprint.parse(text, {
	schema: s.object({ to: s.string() }),
	source: "flag/index.stub",
});
let path = blueprint.render(stub.data.frontmatter.to, values);
let content = blueprint.render(stub.data, values);
let plan = await blueprint.plan([{ path: path.data, content: content.data }], { root });
await blueprint.write(plan.data);
```

| Function    | Does                                                                                    |
| ----------- | --------------------------------------------------------------------------------------- |
| `parse`     | Splits front matter from the body, validates it with any Standard Schema, checks syntax |
| `render`    | Renders a parsed stub or a string with values and filters                               |
| `variables` | What values stubs read, each as text, a flag (`if` only) or a list (`each`)             |
| `plan`      | Marks each file `create`, `replace` or `conflict`; nothing is written                   |
| `write`     | Writes a plan with no conflicts                                                         |

The package defines no front matter keys. A caller's schema decides them, so the kit and the
command line read different ones from the same format. `plan` refuses a path outside the root
and two files with the same path.

### The command line

`sdxc-blueprint` (and `sdxc pkg blueprint`) reads blueprints from
`.config/blueprint/` in the working directory. The command line has no configuration and no
`init` step, so the folder holds the blueprints directly. A blueprint is a folder of stubs, or a
single `<name>.stub` file. Each stub's front matter holds `to`, the path it writes, rendered with
the same values, and optionally `description`, which `--list` shows from `index.stub` (or the
single stub). The file names inside a folder are labels, so `index.stub` and `test.stub` are
enough, and the folder never mirrors the app's tree.

```bash
sdxc pkg blueprint --list
sdxc pkg blueprint flag --name checkout-v2 --beta --variants control --variants treatment
sdxc pkg blueprint flag --name checkout-v2 --dry-run --json
```

- **Values are flags named after placeholders**, in kebab case (`routePath` is `--route-path`).
  Text is required, a value only `if` tests is a boolean flag, and a value `each` walks is a
  repeatable flag.
- **`<blueprint> --help`**, or a run missing a value, prints what the blueprint needs, generated
  from its stubs: each value with where it is used, then the files it writes. A missing value
  prints it to stderr and exits 2; `--help` prints to stdout and exits 0. `--json` gives both as
  data.
- **`--dry-run`** prints each file as `create`, `replace` or `conflict` and writes nothing.
- **A file that exists** is a conflict: nothing is written, the run exits 1 and names every
  conflict, so an agent can remove them or rerun with `--force`.
- `--help`, `--list`, `--dry-run`, `--force` and `--json` are reserved; a stub using one of those
  names as a value is an error.

The program reads its whole command line itself, because its flags come from the blueprint it
runs. `@sdxc/cli` gains that ability: a program with no commands may declare
`argument.rest()` on its root and map a handler to it.

### The kit

`sdxc make` keeps its conventions, kinds and built-in stubs, and renders them through
`@sdxc/blueprint`. It reads only kit stubs: the built-in ones and the overrides an app keeps in
`make.stubs`, which replace a built-in stub of the same name. An app's own blueprints run through
`sdxc pkg blueprint`, never through `sdxc make`.

## Consequences

### Positive

- **Any project gets a generator** - with or without `@sdxc/kit`, from the same format the kit
  uses, so an app's stubs and the kit's read the same way.
- **Self-documenting blueprints** - the values a blueprint takes are read from its stubs, so its
  help is always current.
- **Agent-friendly** - `--dry-run --json` names every conflict before anything is written.
- **One set of case rules** - filters use `@sdxc/strings`, so the kit's own casing helpers can go.

### Negative

- **Less than Hygen** - no actions that edit existing files, no prompts scripted in JavaScript,
  no shell commands. Editing files stays a kit feature built on `@sdxc/codemod`.
- **A new syntax surface** - `if`, `each` and filters are public API, and kit stubs that an app
  overrides follow its releases.

### Neutral

- **Front matter is the caller's** - the command line reads `to` and `description`; the kit reads
  none today.

## Implementation Plan

### Phase 1: Package and command line

**Priority:** High

1. `@sdxc/cli`: let a program with no commands take `argument.rest()`.
2. `@sdxc/blueprint`: `parse`, `render`, `variables`, `plan`, `write`, with tests.
3. `sdxc-blueprint` with `--list`, `--help`, `--dry-run`, `--force` and `--json`.
4. Register it: root README, `sdxc pkg` catalog, sdxc.dev group.

### Phase 2: The kit renders through it

**Priority:** Medium

1. `sdxc make` and `sdxc scaffold` render stubs with `blueprint.render`.
2. Drop the kit's placeholder renderer and its casing helpers.

## Alternatives Considered

### 1. Hygen-style EJS templates

**Rejected because**: a template that runs JavaScript can do anything, which makes a stub hard
to read, impossible to describe from its contents, and a place to hide side effects.

### 2. Front matter actions (`inject`, `append`, `skip_if`, `sh`)

**Rejected for now because**: text-anchored injection breaks on formatting changes, and the
edits the kit needs are structural. A blueprint creates files; the kit edits them with
`@sdxc/codemod`. Revisit if apps ask for it.

### 3. Paths from the template's folder tree (`{{name | kebab}}.ts.stub`)

**Rejected because**: `|` is illegal in Windows file names and braces are awkward in shells;
Angular schematics needed a second syntax for paths. `to` in front matter uses the one syntax.

### 4. `sdxc make` reads an app's blueprints too

**Rejected because**: it mixes the kit's kinds with an app's own under one command. Overrides of
kit stubs stay, since they keep a kit kind with an app's additions.

### 5. Values as `key=value` arguments

**Rejected because**: flags give `--help`, `--no-beta` and repeated lists the shape every other
command line uses.

## References

- [Hygen](https://github.com/jondot/hygen)
- [ADR-145: `@sdxc/cli` Package](./ADR-145-cli-package.md)
- [ADR-187: Package Command Lines](./ADR-187-package-command-lines.md)

## Current Progress

- [ ] Phase 1: Package and command line
- [ ] Phase 2: The kit renders through it
