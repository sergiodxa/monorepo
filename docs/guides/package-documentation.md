# Package Documentation Guidelines

This document describes how to write README files for packages in this monorepo.

## Structure

Every package README should follow this structure:

1. **Title** - Package name as heading
2. **Overview** - Brief description of what the package does and why
3. **Usage** - Quick start examples showing common use cases
4. **API** - Detailed documentation of all exports
5. **Patterns** - Common patterns and integration examples
6. **Related Packages** - Links to related packages in the monorepo
7. **Tips** - Best practices and recommendations

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
