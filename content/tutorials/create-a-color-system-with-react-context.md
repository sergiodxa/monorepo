---
title: How to Create a Color System with React Context
excerpt: Build a semantic color system that lets components inherit colors from their parent context.
tech: react@19.0.0
---

When building a component library, you often need buttons, alerts, and other elements to support semantic colors like `primary`, `danger`, `success`, and `warning`. The typical approach is to pass a `color` prop to every component, but this becomes repetitive when you want all components in a section to share the same color.

Imagine a danger zone in your settings page where every button, alert, and badge should be red. Instead of passing `color="danger"` to each component, you can wrap them in a `ColorProvider` and let them inherit the color automatically. This pattern reduces prop drilling and makes your UI more consistent.

## Define the Color Type

```tsx {% path="app/components/color-context.tsx" %}
import { createContext, use, type ReactNode } from "react";

export type Color = "primary" | "neutral" | "danger" | "warning" | "success";
```

Start by defining the allowed color values as a union type. This gives you type safety when using colors throughout your application.

## Create the Context

```tsx {% path="app/components/color-context.tsx" %}
const ColorContext = createContext<Color>("neutral");
```

Create a React context with `neutral` as the default value. This means components will use `neutral` when no `ColorProvider` is present in the tree.

## Build the useColor Hook

```tsx {% path="app/components/color-context.tsx" %}
export function useColor(propsColor?: Color): Color {
	let contextColor = use(ColorContext);
	return propsColor ?? contextColor;
}
```

The `useColor` hook is the key to this pattern. It accepts an optional `propsColor` parameter and returns either that value or the color from context. This lets components override the inherited color when needed while still respecting the context by default. This same pattern of inheriting values through context works for [keeping heading levels consistent](/tutorials/keep-heading-levels-consistent-with-react-context).

## Create the ColorProvider Component

```tsx {% path="app/components/color-context.tsx" %}
export interface ColorProviderProps {
	color: Color;
	children: ReactNode;
}

export function ColorProvider({ color, children }: ColorProviderProps) {
	return <ColorContext value={color}>{children}</ColorContext>;
}
```

The `ColorProvider` wraps its children with the context value. Any component inside can now access this color through the `useColor` hook.

## Use the Hook in Components

```tsx {% path="app/components/button.tsx" %}
import { useColor, type Color } from "./color-context";

interface ButtonProps {
	color?: Color;
	children: React.ReactNode;
}

export function Button({ color: propsColor, children }: ButtonProps) {
	let color = useColor(propsColor);

	return <button className={`btn btn-${color}`}>{children}</button>;
}
```

Components call `useColor` with their optional `color` prop. If the prop is provided, it takes precedence. Otherwise, the component inherits the color from the nearest `ColorProvider`.

## Wrap Components with ColorProvider

```tsx {% path="app/routes/settings.tsx" %}
import { ColorProvider } from "~/components/color-context";
import { Button } from "~/components/button";
import { Alert } from "~/components/alert";

export default function SettingsPage() {
	return (
		<main>
			<section>
				<h2>Profile Settings</h2>
				<Button>Save Changes</Button>
			</section>

			<ColorProvider color="danger">
				<section>
					<h2>Danger Zone</h2>
					<Alert>This action cannot be undone.</Alert>
					<Button>Delete Account</Button>
					<Button color="neutral">Cancel</Button>
				</section>
			</ColorProvider>
		</main>
	);
}
```

In this example, the danger zone section wraps its content with `ColorProvider`. The `Alert` and first `Button` automatically inherit the `danger` color. The cancel button explicitly sets `color="neutral"` to override the context.

## Complete Implementation

Here's the full `color-context.tsx` file for reference:

```tsx {% path="app/components/color-context.tsx" %}
import { createContext, use, type ReactNode } from "react";

export type Color = "primary" | "neutral" | "danger" | "warning" | "success";

const ColorContext = createContext<Color>("neutral");

export function useColor(propsColor?: Color): Color {
	let contextColor = use(ColorContext);
	return propsColor ?? contextColor;
}

export interface ColorProviderProps {
	color: Color;
	children: ReactNode;
}

export function ColorProvider({ color, children }: ColorProviderProps) {
	return <ColorContext value={color}>{children}</ColorContext>;
}
```

This pattern works well for any inherited styling concern: sizes, variants, or themes. The key insight is that the hook accepts an optional override, letting components opt out of inheritance when needed while keeping the common case simple. You can combine this semantic color system with a [color scheme toggle](/tutorials/add-a-color-scheme-toggle-in-react-router) for user-selectable light and dark modes, or explore [dark mode and dark context](/articles/dark-mode-and-dark-context) for a deeper understanding of context-aware theming.
