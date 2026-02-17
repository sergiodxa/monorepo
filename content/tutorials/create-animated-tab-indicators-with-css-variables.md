---
title: How to Create Animated Tab Indicators with CSS Variables
excerpt: Build smooth animated tab indicators using CSS variables, ResizeObserver, and MutationObserver.
tech: react@19.0.0 react-aria-components@1.0.0
---

Tab components are common in web applications, from navigation menus to settings panels. A static indicator that jumps between tabs works, but an animated indicator that smoothly slides to the selected tab creates a more polished experience.

The challenge is making the indicator respond to dynamic content: tabs can have different widths, the selected tab can change, and the container might resize. You need a way to track the selected tab's position and size in real time, then update the indicator without causing layout thrashing or janky animations.

The solution is to use CSS variables for the indicator's position and size, then update those variables using `ResizeObserver` and `MutationObserver`. This approach keeps the animation logic in CSS while JavaScript handles the measurements.

## Set Up the Tabs Component

Start with a basic tabs component using React Aria Components. The `TabList` component will hold the indicator logic:

```tsx {% path="app/components/tabs.tsx" %}
import { useEffect, useRef } from "react";
import {
	Tabs as AriaTabs,
	TabList as AriaTabList,
	Tab as AriaTab,
	TabPanel as AriaTabPanel,
} from "react-aria-components";

export function Tabs(props: React.ComponentProps<typeof AriaTabs>) {
	return <AriaTabs {...props} className="tabs" />;
}

export function TabList(props: React.ComponentProps<typeof AriaTabList>) {
	let listRef = useRef<HTMLDivElement>(null);

	// Indicator logic will go here

	return <AriaTabList ref={listRef} {...props} className="tab-list" />;
}

export function Tab(props: React.ComponentProps<typeof AriaTab>) {
	return <AriaTab {...props} className="tab" />;
}

export function TabPanel(props: React.ComponentProps<typeof AriaTabPanel>) {
	return <AriaTabPanel {...props} className="tab-panel" />;
}
```

This sets up the basic structure. [React Aria Components](/articles/building-accessible-ui-with-react-aria-components) handles accessibility, keyboard navigation, and adds a `data-selected` attribute to the active tab.

## Calculate the Indicator Position

The indicator needs to know the selected tab's position relative to the tab list. Create a function that reads the selected tab's bounding rect and sets CSS variables on the list element:

```tsx {% path="app/components/tabs.tsx" %}
let updateIndicator = () => {
	let list = listRef.current;
	if (!list) return;

	let selected = list.querySelector<HTMLElement>("[data-selected]");

	if (!selected) {
		list.style.setProperty("--tab-indicator-opacity", "0");
		return;
	}

	let listRect = list.getBoundingClientRect();
	let selectedRect = selected.getBoundingClientRect();

	let left = selectedRect.left - listRect.left + list.scrollLeft;

	list.style.setProperty("--tab-indicator-left", `${left}px`);
	list.style.setProperty("--tab-indicator-width", `${selectedRect.width}px`);
	list.style.setProperty("--tab-indicator-opacity", "1");
};
```

The function queries for the element with `data-selected`, calculates its offset from the list container, and sets three CSS variables: `--tab-indicator-left` for horizontal position, `--tab-indicator-width` for size, and `--tab-indicator-opacity` to hide the indicator when no tab is selected.

Adding `list.scrollLeft` ensures the calculation stays correct when the tab list is scrollable.

## Observe Selection Changes with MutationObserver

The indicator needs to update whenever the selected tab changes. React Aria Components toggles the `data-selected` attribute, so you can watch for that change with a `MutationObserver`:

```tsx {% path="app/components/tabs.tsx" %}
useEffect(() => {
	let list = listRef.current;
	if (!list) return;

	let updateIndicator = () => {
		// ... calculation logic from above
	};

	let mutationObserver = new MutationObserver(updateIndicator);

	mutationObserver.observe(list, {
		subtree: true,
		attributes: true,
		attributeFilter: ["data-selected"],
	});

	updateIndicator(); // Initial calculation

	return () => {
		mutationObserver.disconnect();
	};
}, []);
```

The `attributeFilter` option limits the observer to only fire when `data-selected` changes, avoiding unnecessary updates from other attribute changes.

## Handle Resize with ResizeObserver

Tab widths can change when fonts load, content updates, or the viewport resizes. Use `ResizeObserver` to recalculate when sizes change:

```tsx {% path="app/components/tabs.tsx" %}
useEffect(() => {
	let list = listRef.current;
	if (!list) return;

	let observedSelected: HTMLElement | null = null;

	let updateIndicator = () => {
		let selected = list.querySelector<HTMLElement>("[data-selected]");

		// Track which element we're observing for resize
		if (selected !== observedSelected) {
			if (observedSelected) resizeObserver.unobserve(observedSelected);
			if (selected) resizeObserver.observe(selected);
			observedSelected = selected;
		}

		// ... rest of calculation logic
	};

	let resizeObserver = new ResizeObserver(updateIndicator);
	let mutationObserver = new MutationObserver(updateIndicator);

	resizeObserver.observe(list); // Watch the list container
	mutationObserver.observe(list, {
		subtree: true,
		attributes: true,
		attributeFilter: ["data-selected"],
	});

	updateIndicator();

	return () => {
		resizeObserver.disconnect();
		mutationObserver.disconnect();
	};
}, []);
```

The `ResizeObserver` watches both the list container and the currently selected tab. When the selection changes, it stops observing the old tab and starts observing the new one.

## Optimize with requestAnimationFrame

Multiple resize or mutation events can fire in quick succession. Use `requestAnimationFrame` to batch updates and avoid layout thrashing:

```tsx {% path="app/components/tabs.tsx" %}
useEffect(() => {
	let list = listRef.current;
	if (!list) return;

	let frame = 0;
	let observedSelected: HTMLElement | null = null;

	let updateIndicator = () => {
		let selected = list.querySelector<HTMLElement>("[data-selected]");

		if (selected !== observedSelected) {
			if (observedSelected) resizeObserver.unobserve(observedSelected);
			if (selected) resizeObserver.observe(selected);
			observedSelected = selected;
		}

		if (!selected) {
			list.style.setProperty("--tab-indicator-opacity", "0");
			return;
		}

		let listRect = list.getBoundingClientRect();
		let selectedRect = selected.getBoundingClientRect();
		let left = selectedRect.left - listRect.left + list.scrollLeft;

		list.style.setProperty("--tab-indicator-left", `${left}px`);
		list.style.setProperty("--tab-indicator-width", `${selectedRect.width}px`);
		list.style.setProperty("--tab-indicator-opacity", "1");
	};

	let schedule = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(updateIndicator);
	};

	let resizeObserver = new ResizeObserver(schedule);
	let mutationObserver = new MutationObserver(schedule);

	resizeObserver.observe(list);
	mutationObserver.observe(list, {
		subtree: true,
		attributes: true,
		attributeFilter: ["data-selected"],
	});

	schedule();

	return () => {
		cancelAnimationFrame(frame);
		resizeObserver.disconnect();
		mutationObserver.disconnect();
	};
}, []);
```

The `schedule` function cancels any pending frame before requesting a new one. This ensures only one update runs per frame, even if multiple events fire.

## Add Window Resize Handling

The tab list's position might change when the window resizes, even if the list itself doesn't change size. Add a window resize listener with proper cleanup using `AbortController`:

```tsx {% path="app/components/tabs.tsx" %}
useEffect(() => {
	let list = listRef.current;
	if (!list) return;

	let frame = 0;
	let observedSelected: HTMLElement | null = null;
	let controller = new AbortController();

	let updateIndicator = () => {
		// ... calculation logic
	};

	let schedule = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(updateIndicator);
	};

	let resizeObserver = new ResizeObserver(schedule);
	let mutationObserver = new MutationObserver(schedule);

	resizeObserver.observe(list);
	mutationObserver.observe(list, {
		subtree: true,
		attributes: true,
		attributeFilter: ["data-selected"],
	});

	schedule();

	window.addEventListener("resize", schedule, { signal: controller.signal });

	return () => {
		controller.abort();
		cancelAnimationFrame(frame);
		resizeObserver.disconnect();
		mutationObserver.disconnect();
	};
}, []);
```

Using `AbortController` with the `signal` option automatically removes the event listener when the effect cleans up, avoiding manual `removeEventListener` calls.

## Style the Indicator with CSS

Now create the CSS that uses these variables. The indicator is a pseudo-element that transitions smoothly when the variables change:

```css {% path="app/styles.css" %}
.tab-list {
	position: relative;
	display: flex;
	gap: 0.5rem;
}

.tab-list::after {
	content: "";
	position: absolute;
	bottom: 0;
	left: var(--tab-indicator-left, 0);
	width: var(--tab-indicator-width, 0);
	height: 2px;
	background: currentColor;
	opacity: var(--tab-indicator-opacity, 0);
	transition:
		left 150ms ease,
		width 150ms ease,
		opacity 150ms ease;
	pointer-events: none;
}

.tab {
	padding: 0.5rem 1rem;
	cursor: pointer;
}

.tab[data-selected] {
	font-weight: 600;
}
```

The `transition` property animates the indicator's position and width. The `pointer-events: none` ensures the pseudo-element doesn't interfere with tab clicks.

## Support Vertical Orientation

For vertical tabs, calculate `top` and `height` instead of `left` and `width`:

```tsx {% path="app/components/tabs.tsx" %}
let updateIndicator = () => {
	let selected = list.querySelector<HTMLElement>("[data-selected]");

	if (selected !== observedSelected) {
		if (observedSelected) resizeObserver.unobserve(observedSelected);
		if (selected) resizeObserver.observe(selected);
		observedSelected = selected;
	}

	if (!selected) {
		list.style.setProperty("--tab-indicator-opacity", "0");
		return;
	}

	let listRect = list.getBoundingClientRect();
	let selectedRect = selected.getBoundingClientRect();
	let isVertical = Boolean(list.closest('[data-orientation="vertical"]'));

	if (isVertical) {
		let top = selectedRect.top - listRect.top + list.scrollTop;
		list.style.setProperty("--tab-indicator-top", `${top}px`);
		list.style.setProperty("--tab-indicator-height", `${selectedRect.height}px`);
	} else {
		let left = selectedRect.left - listRect.left + list.scrollLeft;
		list.style.setProperty("--tab-indicator-left", `${left}px`);
		list.style.setProperty("--tab-indicator-width", `${selectedRect.width}px`);
	}

	list.style.setProperty("--tab-indicator-opacity", "1");
};
```

React Aria Components sets `data-orientation="vertical"` on the parent `Tabs` component when using vertical orientation. The indicator checks for this attribute and adjusts its calculations accordingly.

Update the CSS to handle both orientations:

```css {% path="app/styles.css" %}
.tab-list::after {
	content: "";
	position: absolute;
	left: var(--tab-indicator-left, 0);
	top: var(--tab-indicator-top, auto);
	bottom: var(--tab-indicator-top, 0);
	width: var(--tab-indicator-width, 0);
	height: var(--tab-indicator-height, 2px);
	background: currentColor;
	opacity: var(--tab-indicator-opacity, 0);
	transition:
		left 150ms ease,
		top 150ms ease,
		width 150ms ease,
		height 150ms ease,
		opacity 150ms ease;
	pointer-events: none;
}
```

## Final Thoughts

This pattern separates concerns cleanly: JavaScript handles measurements and updates CSS variables, while CSS handles the actual animation. The combination of `MutationObserver` for selection changes and `ResizeObserver` for size changes ensures the indicator stays accurate in all scenarios. You can apply the same ResizeObserver technique when building an [accessible carousel with keyboard navigation](/tutorials/build-an-accessible-carousel-with-keyboard-navigation).

The same technique works for other animated UI elements like navigation highlights, progress indicators, or selection boxes. Anywhere you need to animate an element's position based on another element's dimensions, CSS variables with observers provide a performant solution. CSS variables also enable [context-aware theming](/articles/dark-mode-and-dark-context) when combined with a [color scheme toggle](/tutorials/add-a-color-scheme-toggle-in-react-router).
