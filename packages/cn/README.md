# @pkg/cn

Utility for merging Tailwind CSS classes with proper conflict resolution.

## Overview

The `cn` function combines [clsx](https://github.com/lukeed/clsx) for conditional class handling with [tailwind-merge](https://github.com/dcastil/tailwind-merge) for intelligent Tailwind class merging. This ensures that conflicting utility classes are properly resolved, with later classes taking precedence.

## Installation

```bash
bun add @pkg/cn
```

## Usage

```typescript
import { cn } from "@pkg/cn";

// Basic merging
cn("px-4 py-2", "text-sm");
// => "px-4 py-2 text-sm"

// Conflict resolution (last wins)
cn("p-4", "p-8");
// => "p-8"

// Conditional classes
cn("base", { active: isActive, disabled: isDisabled });
cn("base", isActive && "active");
cn("base", isLoading ? "opacity-50" : "opacity-100");
```

## API

### `cn(...classes: ClassName[]): string`

Merges class names with Tailwind-aware conflict resolution.

### `ClassName`

Re-export of `ClassValue` from clsx. Accepts strings, objects, arrays, and falsy values.

### `ClassNameRecord<Key extends string>`

Typed record for component slot className.

```typescript
type ButtonSlots = "root" | "icon" | "label";
let className: ClassNameRecord<ButtonSlots> = {
	root: "flex items-center",
	icon: ["w-4", "h-4"],
};
```

### `StyleRecord<Key extends string>`

Typed record for component slot styles, including CSS custom properties.

```typescript
type ButtonSlots = "root" | "icon";
let style: StyleRecord<ButtonSlots> = {
	root: { display: "flex", "--button-gap": "8px" },
};
```
