---
title: Building Accessible UI with React Aria Components
excerpt: React Aria Components provide accessible foundations so you can focus on design.
technologies: react-aria-components@1.0.0 react@19.0.0
---

Accessibility is often treated as an afterthought. Teams build components, ship features, and then scramble to add ARIA attributes when an audit reveals problems. This approach leads to inconsistent implementations, missed edge cases, and frustrated users who rely on assistive technologies.

React Aria Components flips this model. Instead of bolting accessibility onto existing components, you start with primitives that are accessible by default. The library handles ARIA semantics, keyboard navigation, focus management, and screen reader announcements. You bring the styling.

## The Problem with Retrofitting Accessibility

Consider building a select dropdown from scratch. The visible part seems simple: a button that opens a list of options. But the accessible version requires:

- Proper ARIA roles (`listbox`, `option`, `combobox`)
- Keyboard navigation (arrow keys, Home, End, type-ahead)
- Focus management when opening and closing
- Screen reader announcements for selection changes
- Support for disabled options
- Mobile touch interactions

Each of these features has edge cases. Arrow key navigation must wrap or stop at boundaries—as demonstrated when [building an accessible carousel with keyboard navigation](/tutorials/build-an-accessible-carousel-with-keyboard-navigation). Type-ahead must handle debouncing and special characters. Focus must return to the trigger when the popover closes. Getting all of this right takes significant effort, and getting it wrong creates barriers for users.

Most teams either skip these features entirely or implement them partially. The result is a component that works for mouse users but fails for everyone else.

## Accessibility as a Foundation

React Aria Components provides unstyled, accessible primitives. A `Select` component from the library includes all the behaviors listed above, tested across browsers and assistive technologies. You compose these primitives and apply your own styles:

```tsx
import { Select, SelectValue, Button, Popover, ListBox, ListBoxItem } from "react-aria-components";

function StatusSelect() {
	return (
		<Select>
			<Button>
				<SelectValue />
			</Button>
			<Popover>
				<ListBox>
					<ListBoxItem id="active">Active</ListBoxItem>
					<ListBoxItem id="pending">Pending</ListBoxItem>
					<ListBoxItem id="archived">Archived</ListBoxItem>
				</ListBox>
			</Popover>
		</Select>
	);
}
```

This component is fully accessible out of the box. Keyboard users can navigate with arrow keys. Screen readers announce the selected value and available options. Focus moves correctly between the trigger and the popover. You did not write any of that logic.

## What React Aria Handles

The library manages three categories of accessibility concerns that are difficult to implement correctly.

### ARIA Semantics

ARIA attributes communicate the purpose and state of UI elements to assistive technologies. A button that opens a menu needs `aria-haspopup` and `aria-expanded`. A checkbox needs `aria-checked`. A tab panel needs `aria-labelledby` pointing to its tab.

React Aria Components applies these attributes automatically based on component state. When a menu opens, `aria-expanded` becomes `true`. When a checkbox is checked, `aria-checked` updates. You never manage these attributes manually.

### Keyboard Navigation

Different components have different keyboard expectations. Menus use arrow keys to move between items. Tabs use arrow keys to switch tabs but Tab to move focus out. Dialogs trap focus inside until closed. Sliders use arrow keys to adjust values.

The library implements these patterns according to WAI-ARIA Authoring Practices. Users who rely on keyboards get the interactions they expect without you studying the specification.

### Focus Management

Focus is invisible to mouse users but critical for keyboard and screen reader users. When a dialog opens, focus should move inside. When it closes, focus should return to the trigger. When a menu item is selected, focus should move appropriately.

React Aria Components handles focus automatically. Open a modal and focus moves to the first focusable element. Close it and focus returns to the button that opened it. Delete an item from a list and focus moves to the next item.

## Building a Component Library

React Aria Components works well as the foundation for a design system. You wrap the primitives with your styling approach and expose a consistent API:

```tsx
import { cn } from "@pkg/cn";
import { Button as AriaButton } from "react-aria-components";

export function Button({ className, variant = "solid", ...props }) {
	return <AriaButton {...props} className={cn("ui-button", className)} data-variant={variant} />;
}
```

The wrapper adds styling concerns: CSS classes, variants, sizes. The underlying `AriaButton` provides the accessible behavior: proper button semantics, keyboard activation, press states, and disabled handling.

This pattern scales across a component library. Each component wraps its React Aria counterpart, adding visual design without reimplementing accessibility:

```tsx
import { cn } from "@pkg/cn";
import { Menu as AriaMenu, MenuItem as AriaMenuItem, MenuTrigger } from "react-aria-components";

export function Menu({ className, ...props }) {
	return <AriaMenu {...props} className={cn("ui-menu", className)} />;
}

Menu.Trigger = MenuTrigger;

Menu.Item = function MenuItem({ className, ...props }) {
	return <AriaMenuItem {...props} className={cn("ui-menu-item", className)} />;
};
```

The [compound component pattern](/articles/compound-component-pattern-in-react) lets consumers compose menus naturally while the library handles ARIA roles, keyboard navigation, and focus management.

## Styling with Data Attributes

React Aria Components exposes component state through data attributes. A pressed button has `data-pressed`. A selected tab has `data-selected`. A focused input has `data-focus-visible`.

These attributes enable styling without JavaScript state management:

```css
.ui-button[data-pressed] {
	transform: scale(0.98);
}

.ui-tab[data-selected] {
	border-bottom-color: var(--color-primary);
}

.ui-input[data-focus-visible] {
	outline: 2px solid var(--color-focus);
}
```

The `data-focus-visible` attribute is particularly valuable. It appears only when focus should be visible (keyboard navigation), not when clicking with a mouse. This matches user expectations: keyboard users see focus indicators, mouse users do not.

## Complex Components Made Simple

Some components have accessibility requirements that would take weeks to implement correctly. A date picker needs calendar navigation, screen reader announcements for date changes, support for different locales, and proper handling of disabled dates. A combobox needs type-ahead filtering, announcement of result counts, and coordination between the input and listbox.

React Aria Components provides these complex components with full accessibility:

```tsx
import { ComboBox, Input, Button, Popover, ListBox, ListBoxItem } from "react-aria-components";

function UserSearch({ users }) {
	return (
		<ComboBox>
			<div className="ui-combobox-group">
				<Input className="ui-combobox-input" />
				<Button className="ui-combobox-button">▼</Button>
			</div>
			<Popover>
				<ListBox items={users}>
					{(user) => <ListBoxItem id={user.id}>{user.name}</ListBoxItem>}
				</ListBox>
			</Popover>
		</ComboBox>
	);
}
```

The combobox filters options as the user types, announces the number of results to screen readers, supports keyboard selection, and handles all the edge cases around focus and selection. This same pattern powers components like a [command palette](/tutorials/build-a-command-palette-component). You provided the UI structure and styling.

## Trade-offs

React Aria Components is not a drop-in replacement for styled component libraries. You must provide all the CSS yourself. For teams that want pre-built designs, libraries like Radix with themes or fully styled systems like Chakra may be faster to adopt.

The library also has a learning curve. Understanding how to compose primitives, style with data attributes, and customize behavior takes time. The documentation is comprehensive but dense.

Finally, bundle size matters for some applications. React Aria Components is modular, so you only import what you use, but complex components like date pickers bring significant code.

## When to Use React Aria Components

The library fits well when:

1. **You have custom design requirements**: If your design system does not match existing component libraries, starting with unstyled primitives is more efficient than overriding opinionated styles.

2. **Accessibility is a priority**: If your users include people who rely on assistive technologies, or if you need to meet WCAG compliance, building on tested foundations reduces risk.

3. **You are building a component library**: If you are creating reusable components for multiple applications, React Aria Components provides a solid base that handles the hard parts.

4. **You want control over rendering**: If you need to customize the DOM structure or integrate with specific styling approaches, unstyled primitives give you that flexibility.

## Conclusion

Accessibility should not be an afterthought bolted onto finished components. React Aria Components provides a different approach: start with accessible primitives and add your design on top.

The library handles ARIA semantics, keyboard navigation, and focus management. You handle colors, spacing, and visual design. The result is components that work for everyone, built on foundations tested across browsers and assistive technologies.

Building accessible UI is still work. But with the right foundation, that work focuses on design and user experience rather than reimplementing specifications. For more on accessible component patterns, see how to [create animated tab indicators](/tutorials/create-animated-tab-indicators-with-css-variables) that work well with keyboard navigation.
