# Package Documentation Guidelines

This document describes how to write README files for packages in this monorepo.

A published package (`private` absent from its `package.json`) follows
[Public Packages](#public-packages) instead of the structure below — its README
ships to npmjs.com and is read by people who can see only that one package.

## Structure

Every internal package README should follow this structure:

1. **Title** - Package name as heading
2. **Overview** - Brief description of what the package does and why
3. **Usage** - Quick start examples showing common use cases
4. **API** - Detailed documentation of all exports
5. **Patterns** - Common patterns and integration examples
6. **Related Packages** - Links to related packages in the monorepo
7. **Tips** - Best practices and recommendations

## Public Packages

The README of a published package is its npm landing page. Write it for a
stranger who can reach only what npm serves, and keep it short — a reference,
not an essay.

Structure:

1. **Title** - Package name, then one line saying what it is
2. **Installation** - `npm add @sdxc/<name>`, plus one line naming any
   third-party or published companion the consumer also installs
3. **Usage** - Two to five focused examples, smallest one first
4. **API** - Every public export, one or two sentences each
5. **Patterns** - How the exports combine on a real task
6. **Versioning** - Dated releases, no compatibility promise, pin an exact date
7. **License** - `MIT`
8. **Author** - `[Sergio Xalambrí](https://sergiodxa.com)`

Rules:

- Link only to what a reader can open from npm: npmjs.com package pages, MDN,
  and the documentation of third-party dependencies. Repository links,
  `/packages/<name>` links, `../<name>/README.md` links, and `docs/adr/` links
  all break outside the monorepo.
- Name only published packages. A private `@sdxc/*` dependency stays out of the
  prose entirely — rewrite the sentence so it stands on its own.
- Keep examples free of internal vocabulary. Application names, route module
  paths, and internal symbols mean nothing to the reader; use generic subjects
  instead.
- Describe the package as an installed dependency. Commands that only run
  inside a checkout belong in the repository documentation.
- Keep the `## Pattern: ...` sections. They show a reader how the exports
  combine on a real task, which the API reference alone never conveys. Place
  them after the API reference, and write each one so it stands alone: generic
  subjects, published dependencies only, and imports included. Skip the
  `Related Packages` and `Tips` sections.
- Show what an export stands in for when a longhand teaches the reader
  something — the raw `Intl` or WebCrypto call, the arithmetic, the try/catch.
  Where no honest one-line equivalent exists, describe the behavior instead of
  inventing one.
- Prefer a sentence over a paragraph, and a code block over a sentence. Drop
  the `**Parameters:** / **Returns:** / **Example:**` scaffolding wherever a
  single sentence carries the same information; keep a parameter list only when
  an options object needs field-by-field explanation.

## Section Guidelines

### Title

Use the package name as an H1 heading, followed by a one-line description.

```markdown
# @sdxc/package-name

One-line description of what this package does.
```

### Overview

Explain:

- What problem the package solves
- Key technologies or patterns used
- Architecture decisions (e.g., server/client split)
- Links to external documentation for underlying libraries

Keep it to 2-3 paragraphs maximum.

### Usage

Show the most common use case with a complete, runnable example. Include:

- Import statements
- Setup/configuration
- Basic usage
- What the output looks like

For packages with multiple entry points, show each one.

### API

Document every public export with:

- **Name and type** (function, class, component, type)
- **Description** of what it does
- **Parameters** with types and descriptions
- **Returns** with type and description
- **Example** showing usage

Format:

```markdown
#### `functionName(param1: Type, param2: Type): ReturnType`

Description of what the function does.

**Parameters:**

- `param1`: Description of first parameter
- `param2`: Description of second parameter

**Returns:**

- Description of return value

**Example:**

\`\`\`typescript
let result = functionName(value1, value2);
\`\`\`
```

### Patterns

Show real-world usage patterns:

- Integration with React Router (loaders, actions, components)
- Combining with other packages in the monorepo
- Common customization scenarios
- Error handling approaches

Each pattern should have a descriptive title and complete code example.

### Related Packages

Link to other packages that work well together or provide similar functionality.

```markdown
## Related Packages

- [`@sdxc/result`](/packages/result) - Result type for explicit error handling
- [`@sdxc/validate`](/packages/validate) - Form validation with Standard Schema
```

### Tips

Numbered list of best practices, gotchas, and recommendations. Keep each tip to 1-2 sentences.

## Template

```markdown
# @sdxc/package-name

One-line description of what this package does.

## Overview

Explain what problem this package solves, the approach it takes, and any key
technologies or patterns it uses. Link to external documentation for underlying
libraries when relevant.

Mention any architectural decisions like server/client splits or why certain
dependencies were chosen.

## Usage

### Basic Example

\`\`\`typescript
import { something } from "@sdxc/package-name";

let result = something();
\`\`\`

### Another Common Use Case

\`\`\`typescript
// Show another common pattern
\`\`\`

## API

### `exportedFunction(param: Type): ReturnType`

Description of what the function does.

**Parameters:**

- `param`: Description of the parameter

**Returns:**

- Description of the return value

**Example:**

\`\`\`typescript
let result = exportedFunction(value);
\`\`\`

### `ExportedClass`

Description of the class.

#### `new ExportedClass(options: Options)`

Creates a new instance.

**Parameters:**

- `options.field1`: Description
- `options.field2`: Description

#### `instance.method(param: Type): ReturnType`

Description of the method.

### `ExportedComponent`

React component description.

**Props:**

- `prop1`: `Type` - Description
- `prop2?`: `Type` - Optional prop description

**Example:**

\`\`\`tsx
<ExportedComponent prop1={value} />
\`\`\`

### Types

#### `SomeType`

\`\`\`typescript
interface SomeType {
field1: string;
field2: number;
}
\`\`\`

## Integration with React Router

### Loader Pattern

\`\`\`typescript
import { something } from "@sdxc/package-name";
import type { Route } from "./+types/route-name";

export async function loader({ request }: Route.LoaderArgs) {
// Show how to use in a loader
}

export default function Component({ loaderData }: Route.ComponentProps) {
// Show how to use loader data
}
\`\`\`

### Action Pattern

\`\`\`typescript
export async function action({ request }: Route.ActionArgs) {
// Show how to use in an action
}
\`\`\`

## Pattern: Descriptive Pattern Name

Explain when to use this pattern.

\`\`\`typescript
// Complete example
\`\`\`

## Pattern: Another Pattern

Explain when to use this pattern.

\`\`\`typescript
// Complete example
\`\`\`

## Related Packages

- [`@sdxc/related`](/packages/related) - Brief description of relationship

## Tips

1. **Tip title** - Explanation of the tip
2. **Another tip** - Explanation
3. **Third tip** - Explanation
```

## Writing Style

- Use `let` instead of `const` in examples
- Use TypeScript for all code examples
- Keep examples minimal but complete
- Prefer real-world scenarios over contrived examples
- Link to external documentation rather than duplicating it
- Use consistent formatting for parameters and return values
