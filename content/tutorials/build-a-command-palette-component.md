---
title: How to Build a Command Palette Component
excerpt: Build a filterable command palette using React Aria Components with custom recursive filtering.
tech: react@19.0.0 react-aria-components@1.0.0
---

Command palettes have become a standard pattern in modern applications, from VS Code to Notion to Linear. They let users quickly search and execute actions without navigating through menus. The challenge is building one that filters items correctly while supporting nested groups and sections. For a different approach using Tailwind UI, see [Building a Command Palette with Remix and Tailwind UI](/articles/building-a-command-palette-with-remix-and-tailwind-ui).

[React Aria Components](/articles/building-accessible-ui-with-react-aria-components) provides accessible primitives like `ListBox` and `TextField`, but it doesn't include a command palette component out of the box. You need to build custom filtering logic that traverses React children recursively to show only matching items while preserving the component structure.

## Create the Command Context

Start by creating a context to share the filter value between the input and the list. This allows the components to communicate without prop drilling.

```tsx {% path="app/components/command.tsx" %}
import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

interface CommandContextValue {
	filterValue: string;
	setFilterValue: (value: string) => void;
}

const CommandContext = createContext<CommandContextValue | null>(null);

export function Command({ children }: { children: ReactNode }) {
	const [filterValue, setFilterValue] = useState("");
	const contextValue = useMemo(() => ({ filterValue, setFilterValue }), [filterValue]);

	return (
		<CommandContext.Provider value={contextValue}>
			<div className="command">{children}</div>
		</CommandContext.Provider>
	);
}
```

The context stores the current filter value and a setter function. Using `useMemo` prevents unnecessary re-renders when the context value object reference changes.

## Build the Input Component

The input component syncs its value with the context. It supports both controlled and uncontrolled modes.

```tsx {% path="app/components/command.tsx" %}
import type { ComponentProps } from "react";
import { useEffect } from "react";
import { Input as AriaInput, TextField as AriaTextField } from "react-aria-components";

interface CommandInputProps extends ComponentProps<typeof AriaTextField> {
	inputProps?: ComponentProps<typeof AriaInput>;
}

Command.Input = function CommandInput({ inputProps, children, ...props }: CommandInputProps) {
	const context = useContext(CommandContext);
	const isControlled = props.value !== undefined;

	useEffect(() => {
		if (!context || !isControlled) return;
		context.setFilterValue(String(props.value));
	}, [context, isControlled, props.value]);

	const handleChange = (value: string) => {
		context?.setFilterValue(value ?? "");
		props.onChange?.(value);
	};

	const textFieldProps = isControlled
		? { ...props, value: props.value, onChange: handleChange }
		: { ...props, defaultValue: props.defaultValue ?? "", onChange: handleChange };

	return (
		<AriaTextField {...textFieldProps} className="command-input">
			{children ?? <AriaInput {...inputProps} className="command-input-field" />}
		</AriaTextField>
	);
};
```

When the input value changes, it updates the context, which triggers filtering in the list. The `useEffect` handles syncing controlled values to the context.

## Extract Text from React Elements

Before filtering, you need to extract searchable text from items. This function recursively traverses React children to build a string from all text content.

```ts {% path="app/components/command.tsx" %}
import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";

function getNodeText(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) {
		return node
			.map((item) => getNodeText(item as ReactNode))
			.filter(Boolean)
			.join(" ");
	}
	if (isValidElement(node)) {
		const element = node as ReactElement<{ children?: ReactNode }>;
		return getNodeText(element.props.children);
	}
	return "";
}
```

This handles strings, numbers, arrays, and React elements. For elements, it recursively extracts text from their children.

## Get Item Text for Filtering

Items can specify their searchable text in multiple ways: a `textValue` prop, an `aria-label`, or their children content. This function checks each source in order.

```ts {% path="app/components/command.tsx" %}
function getItemText(node: ReactNode): string {
	if (!isValidElement(node)) return "";
	const element = node as ReactElement<{
		children?: ReactNode;
		textValue?: string;
		"aria-label"?: string;
	}>;
	if (typeof element.props.textValue === "string") return element.props.textValue;
	if (typeof element.props["aria-label"] === "string") return element.props["aria-label"];
	return getNodeText(element.props.children);
}
```

The `textValue` prop takes priority because it's the explicit way to specify searchable text. This is useful when the visible content differs from what users might search for.

## Filter Nodes Recursively

The core filtering logic traverses the React tree, keeping items that match and preserving parent structure for groups.

```tsx {% path="app/components/command.tsx" %}
import { Children, cloneElement } from "react";
import { ListBoxItem as AriaListBoxItem } from "react-aria-components";

function filterNode(node: ReactNode, filterText: string): ReactNode | null {
	if (!filterText) return node;
	if (typeof node === "string" || typeof node === "number") {
		return String(node).toLowerCase().includes(filterText) ? node : null;
	}
	if (!isValidElement(node)) return null;

	const element = node as ReactElement<{ children?: ReactNode }>;
	const isItem = element.type === Command.Item || element.type === AriaListBoxItem;

	if (isItem) {
		const itemText = getItemText(element).toLowerCase();
		return itemText.includes(filterText) ? element : null;
	}

	if (element.props.children != null) {
		const filteredChildren = Children.toArray(element.props.children)
			.map((child) => filterNode(child, filterText))
			.filter(Boolean) as ReactNode[];
		if (filteredChildren.length === 0) return null;
		return cloneElement(element, element.props, filteredChildren);
	}

	return null;
}
```

For items, it checks if the text matches the filter. For other elements like groups, it recursively filters children and only keeps the parent if at least one child matches. The `cloneElement` call preserves the original element's props while replacing its children with the filtered set.

## Build the List Component

The list component applies the filter and renders matching items using React Aria's `ListBox`.

```tsx {% path="app/components/command.tsx" %}
import { ListBox as AriaListBox } from "react-aria-components";

Command.List = function CommandList<T extends object>({
	children,
	...props
}: ComponentProps<typeof AriaListBox<T>>) {
	const context = useContext(CommandContext);
	const filterText = context?.filterValue.trim().toLowerCase() ?? "";
	const isRenderFunction = typeof children === "function";

	const filteredChildren = useMemo(() => {
		if (isRenderFunction) return [];
		return Children.toArray(children)
			.map((child) => filterNode(child, filterText))
			.filter(Boolean);
	}, [children, filterText, isRenderFunction]);

	if (isRenderFunction) {
		return (
			<AriaListBox {...props} className="command-list">
				{children}
			</AriaListBox>
		);
	}

	const effectiveChildren = filterText ? filteredChildren : Children.toArray(children);

	return (
		<AriaListBox {...props} className="command-list">
			{effectiveChildren}
		</AriaListBox>
	);
};
```

The `useMemo` ensures filtering only runs when children or the filter text changes. When children is a render function (for dynamic items), it passes through to `AriaListBox` directly since filtering would need to happen at the data level instead.

## Add Item and Empty Components

Complete the component with an item wrapper and an empty state.

```tsx {% path="app/components/command.tsx" %}
import { ListBoxItem as AriaListBoxItem } from "react-aria-components";

Command.Item = function CommandItem(props: ComponentProps<typeof AriaListBoxItem>) {
	return <AriaListBoxItem {...props} className="command-item" />;
};

Command.Empty = function CommandEmpty(props: ComponentProps<"div">) {
	return <div {...props} className="command-empty" />;
};
```

The item component wraps `AriaListBoxItem` to provide consistent styling. The empty component displays when no items match the filter.

## Use the Command Palette

Here's how to use the complete command palette in your application:

```tsx {% path="app/routes/home.tsx" %}
import { Command } from "~/components/command";

export default function Home() {
	return (
		<Command>
			<Command.Input placeholder="Search commands..." />
			<Command.List aria-label="Commands" selectionMode="single">
				<Command.Item id="new-file" textValue="New File">
					New File
				</Command.Item>
				<Command.Item id="open-file" textValue="Open File">
					Open File
				</Command.Item>
				<Command.Item id="save" textValue="Save">
					Save
				</Command.Item>
				<Command.Item id="settings" textValue="Settings">
					Settings
				</Command.Item>
			</Command.List>
			<Command.Empty>No commands found</Command.Empty>
		</Command>
	);
}
```

The `textValue` prop on each item specifies the searchable text. When users type in the input, items filter automatically based on matching text.

## Final Thoughts

This pattern gives you full control over filtering behavior while leveraging React Aria's accessibility features. The recursive filtering approach handles nested structures like grouped commands, and the context-based architecture keeps components decoupled. You can organize the compound component exports using [TypeScript namespaces](/tutorials/simplify-component-imports-with-typescript-namespaces) for a cleaner API.

You can extend this further by adding keyboard shortcuts, recent items, or fuzzy matching to the filter logic. The command palette pairs well with a [collapsible sidebar](/tutorials/create-a-collapsible-sidebar-with-cookie-persistence) for a complete navigation experience.
