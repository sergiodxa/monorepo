---
title: How to Create a Collapsible Sidebar with Cookie Persistence
excerpt: Build a responsive sidebar that remembers its state across page reloads using cookies.
tech: react@19.0.0 react-aria-components@1.0.0
---

Sidebars are a common navigation pattern in web applications. Users expect to collapse and expand them to maximize their workspace, and they expect that preference to persist across sessions. On mobile devices, sidebars typically transform into a sheet that slides in from the side.

The challenge is implementing all of this in a way that feels seamless: the sidebar should remember its state without a flash of incorrect layout on page load, respond to keyboard shortcuts for power users, and gracefully adapt to different screen sizes.

## Create the Sidebar Context

Start by defining the context that will manage the sidebar state. This context tracks whether the sidebar is open, whether we're on mobile, and provides a toggle function.

```tsx {% path="app/components/sidebar.tsx" %}
import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_COOKIE_NAME = "sidebar:state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarContextValue {
	state: "expanded" | "collapsed";
	open: boolean;
	setOpen: (open: boolean) => void;
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	isMobile: boolean;
	toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
	let context = useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a Sidebar.Provider");
	}
	return context;
}
```

The context separates desktop and mobile states: `open` controls the desktop sidebar, while `openMobile` controls the mobile sheet. This separation allows different behaviors for each viewport. This pattern of using React Context to share state across components is similar to how you might [keep heading levels consistent with React Context](/tutorials/keep-heading-levels-consistent-with-react-context).

## Detect Mobile Viewport

Create a hook to detect whether the user is on a mobile device using a media query listener.

```ts {% path="app/components/sidebar.tsx" %}
function useIsMobile(): boolean {
	let [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		let mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		setIsMobile(mql.matches);

		function handleChange(event: MediaQueryListEvent) {
			setIsMobile(event.matches);
		}

		mql.addEventListener("change", handleChange);
		return () => mql.removeEventListener("change", handleChange);
	}, []);

	return isMobile;
}
```

This hook uses `matchMedia` to listen for viewport changes in real time. When the user resizes their browser or rotates their device, the sidebar automatically switches between desktop and mobile modes.

## Build the Sidebar Provider

The provider component manages all sidebar state and persists it to a cookie when changed.

```tsx {% path="app/components/sidebar.tsx" %}
interface ProviderProps {
	children: React.ReactNode;
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

function SidebarProvider({
	children,
	defaultOpen = true,
	open: controlledOpen,
	onOpenChange,
}: ProviderProps) {
	let isMobile = useIsMobile();
	let [openMobile, setOpenMobile] = useState(false);

	let isControlled = controlledOpen !== undefined;
	let [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	let open = isControlled ? controlledOpen : uncontrolledOpen;

	let setOpen = useCallback(
		(value: boolean | ((prev: boolean) => boolean)) => {
			let openValue = open ?? defaultOpen;
			let resolvedValue = typeof value === "function" ? value(openValue) : value;
			if (!isControlled) {
				setUncontrolledOpen(resolvedValue);
			}
			onOpenChange?.(resolvedValue);

			// Persist state in cookie
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${resolvedValue}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
		},
		[defaultOpen, isControlled, onOpenChange, open],
	);

	let toggleSidebar = useCallback(() => {
		if (isMobile) {
			setOpenMobile((prev) => !prev);
		} else {
			setOpen((prev) => !prev);
		}
	}, [isMobile, setOpen]);

	let state: "expanded" | "collapsed" = open ? "expanded" : "collapsed";

	let contextValue = useMemo<SidebarContextValue>(
		() => ({
			state,
			open: open ?? defaultOpen,
			setOpen,
			openMobile,
			setOpenMobile,
			isMobile,
			toggleSidebar,
		}),
		[state, open, defaultOpen, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar],
	);

	return (
		<SidebarContext.Provider value={contextValue}>
			<div data-sidebar-provider data-state={state} data-mobile={isMobile || undefined}>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}
```

The provider supports both controlled and uncontrolled modes. When the state changes, it writes to a cookie with a 7 day expiration. The `toggleSidebar` function intelligently switches between desktop collapse and mobile sheet based on the current viewport.

## Add the Keyboard Shortcut

Power users expect keyboard shortcuts. Add an effect to the provider that listens for `Cmd+B` (Mac) or `Ctrl+B` (Windows/Linux).

```tsx {% path="app/components/sidebar.tsx" %}
// Add this effect inside SidebarProvider, before the return statement
useEffect(() => {
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			toggleSidebar();
		}
	}

	window.addEventListener("keydown", handleKeyDown);
	return () => window.removeEventListener("keydown", handleKeyDown);
}, [toggleSidebar]);
```

This gives users a quick way to toggle the sidebar without reaching for their mouse. The `Cmd+B` shortcut is a common convention used by VS Code and other applications.

## Render the Desktop Sidebar

The main sidebar component renders differently based on the viewport and collapsible mode.

```tsx {% path="app/components/sidebar.tsx" %}
import {
	Button as AriaButton,
	Dialog as AriaDialog,
	Modal as AriaModal,
	ModalOverlay as AriaModalOverlay,
} from "react-aria-components";

interface SidebarProps extends React.ComponentProps<"aside"> {
	variant?: "sidebar" | "floating" | "inset";
	collapsible?: "none" | "offcanvas" | "icon";
	side?: "left" | "right";
}

function Sidebar({
	variant = "sidebar",
	collapsible = "offcanvas",
	side = "left",
	children,
	...props
}: SidebarProps) {
	let { isMobile, state, openMobile, setOpenMobile } = useSidebar();

	if (collapsible === "none") {
		return (
			<aside {...props} data-variant={variant} data-collapsible={collapsible} data-side={side}>
				{children}
			</aside>
		);
	}

	if (isMobile) {
		return (
			<AriaModalOverlay isOpen={openMobile} onOpenChange={setOpenMobile} isDismissable>
				<AriaModal data-side={side}>
					<AriaDialog aria-label="Navigation">
						<aside {...props} data-variant={variant} data-side={side} data-mobile>
							{children}
						</aside>
					</AriaDialog>
				</AriaModal>
			</AriaModalOverlay>
		);
	}

	return (
		<aside
			{...props}
			data-variant={variant}
			data-collapsible={collapsible}
			data-side={side}
			data-state={state}
			data-collapsed={state === "collapsed" || undefined}
		>
			{children}
		</aside>
	);
}
```

On mobile, the sidebar renders inside a [React Aria](/articles/building-accessible-ui-with-react-aria-components) modal overlay. This provides built-in accessibility features: focus trapping, escape key dismissal, and proper ARIA attributes. The `isDismissable` prop allows users to close the sheet by clicking outside.

## Create the Sidebar Trigger

Add a button component that toggles the sidebar state.

```tsx {% path="app/components/sidebar.tsx" %}
interface TriggerProps extends React.ComponentProps<typeof AriaButton> {
	onPress?: React.ComponentProps<typeof AriaButton>["onPress"];
}

function SidebarTrigger({ onPress, ...props }: TriggerProps) {
	let { toggleSidebar, state } = useSidebar();

	return (
		<AriaButton
			{...props}
			data-state={state}
			onPress={(event) => {
				toggleSidebar();
				onPress?.(event);
			}}
		/>
	);
}
```

The trigger button uses React Aria's `Button` component for proper keyboard and accessibility support. It exposes the current state via a data attribute so you can style it differently when collapsed.

## Read the Cookie on the Server

To avoid a flash of incorrect state on page load, read the cookie on the server and pass it as the `defaultOpen` prop.

```tsx {% path="app/root.tsx" %}
import type { Route } from "./+types/root";
import { Sidebar } from "~/components/sidebar";

export async function loader({ request }: Route.LoaderArgs) {
	let cookieHeader = request.headers.get("Cookie") ?? "";
	let sidebarOpen = cookieHeader.includes("sidebar:state=true");
	return { sidebarOpen };
}

export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<Sidebar.Provider defaultOpen={loaderData.sidebarOpen}>
			<Sidebar side="left" collapsible="icon">
				{/* Sidebar content */}
			</Sidebar>
			<main>
				<Sidebar.Trigger>Toggle Sidebar</Sidebar.Trigger>
				{/* Main content */}
			</main>
		</Sidebar.Provider>
	);
}
```

By reading the cookie in the loader and passing it to `defaultOpen`, the initial HTML already has the correct state. This eliminates the flash that would occur if you read from `localStorage` on the client.

## Style the Sidebar States

Use CSS to handle the different sidebar states. The data attributes make it easy to target specific states.

```css {% path="app/styles/sidebar.css" %}
[data-sidebar-provider] {
	display: flex;
	min-height: 100vh;
}

[data-sidebar-provider] aside {
	width: 16rem;
	transition: width 0.2s ease-in-out;
}

[data-sidebar-provider] aside[data-state="collapsed"] {
	width: 3rem;
}

[data-sidebar-provider] aside[data-collapsible="icon"][data-state="collapsed"] {
	/* Show only icons when collapsed */
}

[data-sidebar-provider]
	aside[data-collapsible="icon"][data-state="collapsed"]
	[data-slot="menu-button"]
	span {
	display: none;
}
```

The data attributes provide clear hooks for styling. The `collapsible="icon"` variant collapses to show only icons, while `collapsible="offcanvas"` completely hides the sidebar.

## Final Thoughts

This pattern gives you a sidebar that works across all devices, remembers user preferences, and responds to keyboard shortcuts. The cookie persistence ensures no flash of incorrect state, and the React Aria integration provides accessibility out of the box. You can apply the same cookie persistence approach to implement a [color scheme toggle](/tutorials/add-a-color-scheme-toggle-in-react-router).

You can extend this further by adding tooltips that appear when hovering over icons in collapsed mode, or by adding a rail component that lets users drag to resize the sidebar width. Consider adding a [command palette](/tutorials/build-a-command-palette-component) to give users keyboard-driven navigation within your sidebar.
