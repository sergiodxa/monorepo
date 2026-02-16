# @pkg/cn

Utility for merging Tailwind CSS classes with proper conflict resolution.

## Overview

The `cn` function combines [clsx](https://github.com/lukeed/clsx) for conditional class handling with [tailwind-merge](https://github.com/dcastil/tailwind-merge) for intelligent Tailwind class merging. This ensures that conflicting utility classes are properly resolved, with later classes taking precedence.

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

## Patterns

### Dark mode conditional classes

```typescript
cn("bg-white text-gray-900", "dark:bg-gray-900 dark:text-white", { "dark:bg-gray-800": isDimmed });
```

### Grid columns based on item count

```typescript
cn("grid gap-4", {
	"grid-cols-1": items.length === 1,
	"grid-cols-2": items.length === 2,
	"grid-cols-3": items.length >= 3,
});
```

### Component variants with data attributes

```typescript
cn(
	"rounded-md px-4 py-2 font-medium",
	"data-[variant=primary]:bg-blue-600 data-[variant=primary]:text-white",
	"data-[variant=secondary]:bg-gray-200 data-[variant=secondary]:text-gray-900",
	"data-[size=sm]:px-2 data-[size=sm]:py-1 data-[size=sm]:text-sm",
	"data-[size=lg]:px-6 data-[size=lg]:py-3 data-[size=lg]:text-lg",
);
```

### Array syntax for grouped conditionals

```typescript
cn([
	"flex items-center gap-2",
	{
		"opacity-50 cursor-not-allowed": isDisabled,
		"animate-pulse": isLoading,
	},
]);
```

## API

### `cn(...classes: cn.ClassName[]): string`

Merges class names with Tailwind-aware conflict resolution.

### `cn.ClassName`

Re-export of `ClassValue` from clsx. Accepts strings, objects, arrays, and falsy values.

### `cn.ClassNameRecord<Key extends string>`

Typed record for component slot className.

```typescript
type ButtonSlots = "root" | "icon" | "label";
let className: cn.ClassNameRecord<ButtonSlots> = {
	root: "flex items-center",
	icon: ["w-4", "h-4"],
};
```

### `extendClassName(config): (...classes: cn.ClassName[]) => string`

Factory function to create a custom `cn` with extended tailwind-merge configuration. Useful for apps with custom utility classes that should conflict with each other.

```typescript
import { extendClassName } from "@pkg/cn";

let cn = extendClassName({
	extend: {
		classGroups: {
			stack: ["stack-v", "stack-h"],
		},
	},
});

cn("stack-v", "stack-h"); // => "stack-h"
```

Types are available via both `cn` and `extendClassName` namespaces:

- `extendClassName.Config` - Configuration type for extendClassName
- `extendClassName.ClassName` - Same as `cn.ClassName`
- `extendClassName.ClassNameRecord<Key>` - Same as `cn.ClassNameRecord<Key>`

When using `extendClassName`, you may want to also export a `cn` namespace from your app to keep the types accessible:

```typescript
// app/lib/cn.ts
import { extendClassName } from "@pkg/cn";

export let cn = extendClassName({
	extend: {
		classGroups: {
			stack: ["stack-v", "stack-h"],
		},
	},
});

export namespace cn {
	export type ClassName = extendClassName.ClassName;
	export type ClassNameRecord<Key extends string> = extendClassName.ClassNameRecord<Key>;
}
```

## Tips

1. **Use arrays for cleaner conditional class organization** - Group related classes together with array syntax to improve readability when you have multiple conditional classes.

2. **Prefer object syntax for boolean conditionals** - When toggling classes based on boolean values, `{ "class-name": condition }` is often cleaner than `condition && "class-name"`.

3. **Keep variant classes grouped logically** - Organize classes by concern (layout, colors, states) rather than mixing them, making it easier to understand and modify component styles.

## Related Packages

- [`@pkg/ui`](../ui) - UI components that use cn for styling
