# @pkg/package-name

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
import { something } from "@pkg/package-name";

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
import { something } from "@pkg/package-name";
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

- [`@pkg/related`](/packages/related) - Brief description of relationship

## Tips

1. **Tip title** - Explanation of the tip
2. **Another tip** - Explanation
3. **Third tip** - Explanation
