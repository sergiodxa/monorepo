---
title: Compound Component Pattern in React
excerpt: Build flexible, composable UI components using the compound component pattern with TypeScript namespaces.
technologies: react@19.0.0
---

React components can be designed in many ways. You can pass everything as props, render children conditionally, or let consumers compose pieces together. The compound component pattern takes the composition approach, giving consumers full control over structure while keeping related components grouped under a single namespace.

## What Makes a Compound Component

A compound component is a set of components that work together to form a complete UI element. Instead of a single component with many props controlling its internals, you expose multiple smaller components that consumers arrange as needed.

Consider a Dialog. A monolithic approach might look like this:

```tsx
<Dialog
	title="Confirm Action"
	description="Are you sure you want to proceed?"
	showCloseButton
	footer={<Button>Confirm</Button>}
/>
```

This works, but it limits flexibility. What if you need custom content between the title and footer? What if you want to omit the description entirely? Every new requirement means adding more props.

The compound pattern flips this around:

```tsx
<Dialog>
	<Dialog.Header>
		<Dialog.Title>Confirm Action</Dialog.Title>
		<Dialog.Close />
	</Dialog.Header>
	<Dialog.Description>Are you sure you want to proceed?</Dialog.Description>
	<Dialog.Footer>
		<Button>Confirm</Button>
	</Dialog.Footer>
</Dialog>
```

Consumers decide what to render and where. The component library provides the building blocks.

## Organizing with TypeScript Namespaces

TypeScript namespaces offer a clean way to group related components and their types. For a deeper dive into this technique, see [simplifying component imports with TypeScript namespaces](/tutorials/simplify-component-imports-with-typescript-namespaces). The main component function serves as the namespace container, with subcomponents attached as properties.

```ts {% path="components/dialog.tsx" %}
import type { ComponentProps, ReactNode } from "react";

export namespace Dialog {
	export interface Props {
		className?: string;
		children: ReactNode;
	}

	export interface HeaderProps {
		className?: string;
		children: ReactNode;
	}

	export interface TitleProps {
		className?: string;
		children: ReactNode;
	}

	export interface FooterProps {
		className?: string;
		children: ReactNode;
	}
}
```

The namespace groups all the prop interfaces together. Consumers importing `Dialog` get access to `Dialog.Props`, `Dialog.HeaderProps`, and so on without additional imports.

## Building the Component Structure

Each subcomponent is a simple function that renders its piece of the UI:

```tsx {% path="components/dialog.tsx" %}
export function Dialog({ className, children }: Dialog.Props) {
	return <div className={cn("dialog", className)}>{children}</div>;
}

function Header({ className, children }: Dialog.HeaderProps) {
	return <div className={cn("dialog-header", className)}>{children}</div>;
}

function Title({ className, children }: Dialog.TitleProps) {
	return <h2 className={cn("dialog-title", className)}>{children}</h2>;
}

function Footer({ className, children }: Dialog.FooterProps) {
	return <div className={cn("dialog-footer", className)}>{children}</div>;
}
```

Then attach the subcomponents to the main function:

```ts {% path="components/dialog.tsx" %}
Dialog.Header = Header;
Dialog.Title = Title;
Dialog.Footer = Footer;
```

This creates the `Dialog.Header`, `Dialog.Title`, and `Dialog.Footer` syntax that consumers use.

## Benefits of This Approach

**Flexible composition**: Consumers control the structure. They can reorder elements, omit pieces, or add custom content between subcomponents. The component library does not dictate layout.

**Clear API surface**: The dot notation makes relationships obvious. `Dialog.Title` clearly belongs to `Dialog`. Autocomplete in editors shows all available subcomponents when you type `Dialog.`.

**Encapsulation without rigidity**: Each subcomponent handles its own concerns (styling, accessibility attributes, event handlers) while remaining independent. The parent component does not need to know about every possible child configuration.

**Type colocation**: Keeping interfaces in the namespace means types live next to their components. When you update a component, its types are right there. Consumers can reference types like `Dialog.TitleProps` without hunting through separate type files.

## When Compound Components Make Sense

This pattern shines for UI elements with variable internal structure: dialogs, cards, menus, tabs, accordions. You can see compound components in action when [building a composable heatmap component](/tutorials/build-a-composable-heatmap-component). Anywhere consumers might want to customize what appears and in what order.

For simpler components with fixed structure, the pattern adds unnecessary complexity. A `Button` component does not need `Button.Icon` and `Button.Label` subcomponents if the icon always appears before the label. Props work fine there.

The decision comes down to flexibility requirements. If consumers will want to rearrange, omit, or extend parts of the component, compound components give them that power. If the structure is always the same, keep it simple.

## Sharing State Between Subcomponents

Sometimes subcomponents need to communicate. A `Tabs` component might need `Tabs.List` and `Tabs.Panel` to share the active tab state. React Context handles this:

```tsx {% path="components/tabs.tsx" %}
import { createContext, useContext, useState } from "react";

interface TabsContextValue {
	activeTab: string;
	setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
	const context = useContext(TabsContext);
	if (!context) throw new Error("Tabs components must be used within Tabs");
	return context;
}

export function Tabs({ children, defaultTab }: Tabs.Props) {
	const [activeTab, setActiveTab] = useState(defaultTab);
	return <TabsContext value={{ activeTab, setActiveTab }}>{children}</TabsContext>;
}
```

Subcomponents call `useTabs()` to access shared state. The context stays internal to the component family, invisible to consumers who just compose the pieces together.

## Compound Components and Accessibility

The pattern works well with accessibility libraries like [React Aria Components](/articles/building-accessible-ui-with-react-aria-components). Each subcomponent can handle its own ARIA attributes while the parent manages relationships:

```tsx {% path="components/dialog.tsx" %}
import { Dialog as AriaDialog, Heading } from "react-aria-components";

function Title({ className, ...props }: Dialog.TitleProps) {
	return <Heading {...props} slot="title" className={cn("dialog-title", className)} />;
}
```

The `slot="title"` connects this heading to the dialog's `aria-labelledby`. Consumers do not need to wire up IDs manually. The compound structure handles accessibility relationships internally.

## Final Thoughts

The compound component pattern trades implicit behavior for explicit composition. Consumers write more JSX, but they gain full control over structure. The namespace organization keeps related pieces together while TypeScript provides type safety across the component family.

This approach requires more upfront design work. You need to decide which pieces to expose and how they relate. But for complex UI elements that need flexibility—like a [command palette](/tutorials/build-a-command-palette-component)—compound components provide a clean API that scales with consumer requirements.
