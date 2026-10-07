# Package Documentation Guidelines

This document describes how to write README files for packages in this monorepo.

A package README is its npm landing page. Write it for a stranger who can reach
only what npm serves, and keep it short — a reference, not an essay.

## Structure

Every package README follows this structure:

1. **Title** - Package name, then one line saying what it is
2. **Installation** - `npm add @sdxc/<name>`, plus one line naming any
   third-party or `@sdxc/*` companion the consumer also installs
3. **Usage** - Two to five focused examples, smallest one first
4. **API** - Every public export, one or two sentences each
5. **Patterns** - How the exports combine on a real task
6. **Versioning** - Dated releases, no compatibility promise, pin an exact date
7. **License** - `MIT`
8. **Author** - `[Sergio Xalambrí](https://sergiodxa.com)`

## Rules

- Link only to what a reader can open from npm: npmjs.com package pages, MDN,
  and the documentation of third-party dependencies. Repository links,
  `/packages/<name>` links, `../<name>/README.md` links, and `docs/adr/` links
  all break outside the monorepo. Link another `@sdxc/*` package through its
  npmjs.com page.
- Keep examples free of internal vocabulary. Application names, route module
  paths, `~/` aliases, and internal symbols mean nothing to the reader; use
  generic subjects instead.
- Describe the package as an installed dependency. Commands that only run
  inside a checkout belong in the repository documentation.
- Write each `## Pattern: ...` section so it stands alone: generic subjects,
  published dependencies only, and imports included.
- Show what an export stands in for when a longhand teaches the reader
  something — the raw `Intl` or WebCrypto call, the arithmetic, the try/catch.
  Where no honest one-line equivalent exists, describe the behavior instead of
  inventing one.
- Prefer a sentence over a paragraph, and a code block over a sentence. Skip
  `**Parameters:** / **Returns:** / **Example:**` scaffolding wherever a single
  sentence carries the same information; keep a parameter list only when an
  options object needs field-by-field explanation.

## Section Guidelines

### Title

Use the package name as an H1 heading, followed by a one-line description.

```markdown
# @sdxc/package-name

One-line description of what this package does.
```

### Installation

Show the install command, then name in one line any peer or companion package
the consumer installs alongside it.

```markdown
## Installation

\`\`\`sh
npm add @sdxc/package-name
\`\`\`
```

### Usage

Open with the smallest complete example — imports included — and build up to
the common cases. For packages with multiple entry points, show each one.

### API

Document every public export in one or two sentences under a heading that
carries its signature. Group types under their own heading. Reach for a
parameter list only for an options object whose fields need explanation.

```markdown
### `functionName(input: string, options?: Options): Result`

What the function returns and the case a caller has to handle.

\`\`\`typescript
let result = functionName("value");
\`\`\`
```

### Patterns

Show how the exports combine on a real task: wiring the package into a request
handler, pairing it with another published package, customizing a default, or
handling its errors. Place them after the API reference, give each a
descriptive title, and include a complete code example. They show a reader how
the exports combine, which the API reference alone never conveys.

### Versioning

Use the shared text: releases are dated `YYYY.M.D`, a later date carries no
compatibility promise, and a consumer pins one exact date. Copy the section
from an existing package README and change only the package name in the
`dependencies` example.

### License and Author

`MIT`, and `[Sergio Xalambrí](https://sergiodxa.com)`.

## Template

```text
# @sdxc/package-name

One-line description of what this package does.

## Installation

\`\`\`sh
npm add @sdxc/package-name
\`\`\`

## Usage

\`\`\`typescript
import { something } from "@sdxc/package-name";

let result = something();
\`\`\`

## API

### `something(input: Type): ReturnType`

What it returns and when.

### `SomeClass`

What an instance holds and the guarantee it gives.

#### `new SomeClass(options: Options)`

- `options.field1`: Description
- `options.field2`: Description

### Types

#### `SomeType`

What a value of this type stands for.

## Pattern: Descriptive Pattern Name

When to reach for this pattern.

\`\`\`typescript
import { something } from "@sdxc/package-name";

// Complete example
\`\`\`

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

\`\`\`json
{
	"dependencies": {
		"@sdxc/package-name": "2026.9.4"
	}
}
\`\`\`

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
```

## Writing Style

- Use `let` instead of `const` in examples
- Use TypeScript for all code examples
- Keep examples minimal but complete
- Prefer real-world scenarios over contrived examples
- Link to external documentation rather than duplicating it
