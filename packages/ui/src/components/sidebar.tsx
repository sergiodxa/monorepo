import type { ComponentProps, ReactNode } from "react";

import { cn } from "@pkg/cn";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
	Button as AriaButton,
	Dialog as AriaDialog,
	Link as AriaLink,
	Modal as AriaModal,
	ModalOverlay as AriaModalOverlay,
	Tooltip as AriaTooltip,
	TooltipTrigger as AriaTooltipTrigger,
} from "react-aria-components";

import { type Color, ColorProvider, useColor } from "./color-context";

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

export namespace Sidebar {
	export type Variant = "sidebar" | "floating" | "inset";
	export type Collapsible = "none" | "offcanvas" | "icon";
	export type Side = "left" | "right";

	export interface ProviderProps {
		children: ReactNode;
		defaultOpen?: boolean;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	export interface Props extends Omit<ComponentProps<"aside">, "className"> {
		className?: cn.ClassName;
		variant?: Variant;
		collapsible?: Collapsible;
		side?: Side;
	}

	export interface HeaderProps extends Omit<ComponentProps<"header">, "className"> {
		className?: cn.ClassName;
	}

	export interface ContentProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface FooterProps extends Omit<ComponentProps<"footer">, "className"> {
		className?: cn.ClassName;
	}

	export interface GroupProps extends Omit<ComponentProps<"section">, "className"> {
		className?: cn.ClassName;
	}

	export interface GroupLabelProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface GroupActionProps extends Omit<ComponentProps<typeof AriaButton>, "className"> {
		className?: cn.ClassName;
	}

	export interface GroupContentProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface MenuProps extends Omit<ComponentProps<"ul">, "className"> {
		className?: cn.ClassName;
	}

	export interface MenuItemProps extends Omit<ComponentProps<"li">, "className"> {
		className?: cn.ClassName;
	}

	export type MenuButtonSize = "sm" | "md" | "lg";

	export interface MenuButtonProps extends Omit<ComponentProps<typeof AriaButton>, "className"> {
		className?: cn.ClassName;
		size?: MenuButtonSize;
		active?: boolean;
		/** Tooltip text to show in collapsed icon mode */
		tooltip?: ReactNode;
	}

	export interface MenuLinkProps extends Omit<
		ComponentProps<typeof AriaLink>,
		"className" | "aria-current"
	> {
		className?: cn.ClassName;
		active?: boolean;
		"aria-current"?: ComponentProps<"a">["aria-current"];
		/** Tooltip text to show in collapsed icon mode */
		tooltip?: ReactNode;
	}

	export interface MenuActionProps extends Omit<ComponentProps<typeof AriaButton>, "className"> {
		className?: cn.ClassName;
	}

	export interface MenuBadgeProps extends Omit<ComponentProps<"span">, "className"> {
		className?: cn.ClassName;
	}

	export interface MenuSkeletonProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
		showIcon?: boolean;
	}

	export interface MenuSubProps extends Omit<ComponentProps<"ul">, "className"> {
		className?: cn.ClassName;
	}

	export interface MenuSubItemProps extends Omit<ComponentProps<"li">, "className"> {
		className?: cn.ClassName;
	}

	export interface MenuSubButtonProps extends Omit<ComponentProps<typeof AriaButton>, "className"> {
		className?: cn.ClassName;
		active?: boolean;
	}

	export interface NavProps extends Omit<ComponentProps<"nav">, "className"> {
		className?: cn.ClassName;
	}

	export interface ItemProps extends Omit<
		ComponentProps<typeof AriaLink>,
		"className" | "aria-current"
	> {
		className?: cn.ClassName;
		color?: Color;
		current?: boolean;
		"aria-current"?: ComponentProps<"a">["aria-current"];
	}

	export interface RailProps extends Omit<ComponentProps<typeof AriaButton>, "className"> {
		className?: cn.ClassName;
	}

	export interface TriggerProps extends Omit<
		ComponentProps<typeof AriaButton>,
		"className" | "onPress"
	> {
		className?: cn.ClassName;
		onPress?: ComponentProps<typeof AriaButton>["onPress"];
	}

	export interface InsetProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface SeparatorProps extends Omit<ComponentProps<"hr">, "className"> {
		className?: cn.ClassName;
	}
}

export function Sidebar({
	className,
	variant = "sidebar",
	collapsible = "offcanvas",
	side = "left",
	children,
	...props
}: Sidebar.Props) {
	let { isMobile, state, openMobile, setOpenMobile } = useSidebar();

	if (collapsible === "none") {
		return (
			<aside
				{...props}
				data-component="sidebar"
				data-variant={variant}
				data-collapsible={collapsible}
				data-side={side}
				className={cn("ui-sidebar", className)}
			>
				{children}
			</aside>
		);
	}

	if (isMobile) {
		return (
			<AriaModalOverlay
				isOpen={openMobile}
				onOpenChange={setOpenMobile}
				isDismissable
				className="ui-sheet-overlay"
			>
				<AriaModal data-side={side} className={cn("ui-sheet", "ui-sidebar-mobile")}>
					<AriaDialog className="ui-sheet-content outline-none">
						<aside
							{...props}
							data-component="sidebar"
							data-variant={variant}
							data-collapsible={collapsible}
							data-side={side}
							data-mobile
							className={cn("ui-sidebar-mobile-inner", className)}
						>
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
			data-component="sidebar"
			data-variant={variant}
			data-collapsible={collapsible}
			data-side={side}
			data-state={state}
			data-collapsed={state === "collapsed" || undefined}
			className={cn("ui-sidebar", className)}
		>
			{children}
		</aside>
	);
}

Sidebar.Provider = function SidebarProvider({
	children,
	defaultOpen = true,
	open: controlledOpen,
	onOpenChange,
}: Sidebar.ProviderProps) {
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

	// Keyboard shortcut (cmd+b / ctrl+b)
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
			<div
				data-sidebar-provider
				data-state={state}
				data-mobile={isMobile || undefined}
				className="ui-sidebar-provider"
			>
				{children}
			</div>
		</SidebarContext.Provider>
	);
};

Sidebar.Header = function SidebarHeader({ className, ...props }: Sidebar.HeaderProps) {
	return <header {...props} data-slot="header" className={cn("ui-sidebar-header", className)} />;
};

Sidebar.Content = function SidebarContent({ className, ...props }: Sidebar.ContentProps) {
	return <div {...props} data-slot="content" className={cn("ui-sidebar-content", className)} />;
};

Sidebar.Footer = function SidebarFooter({ className, ...props }: Sidebar.FooterProps) {
	return <footer {...props} data-slot="footer" className={cn("ui-sidebar-footer", className)} />;
};

Sidebar.Group = function SidebarGroup({ className, ...props }: Sidebar.GroupProps) {
	return <section {...props} data-slot="group" className={cn("ui-sidebar-group", className)} />;
};

Sidebar.GroupLabel = function SidebarGroupLabel({ className, ...props }: Sidebar.GroupLabelProps) {
	return (
		<div {...props} data-slot="group-label" className={cn("ui-sidebar-group-label", className)} />
	);
};

Sidebar.GroupAction = function SidebarGroupAction({
	className,
	...props
}: Sidebar.GroupActionProps) {
	return (
		<AriaButton
			{...props}
			data-slot="group-action"
			className={cn("ui-sidebar-group-action", className)}
		/>
	);
};

Sidebar.GroupContent = function SidebarGroupContent({
	className,
	...props
}: Sidebar.GroupContentProps) {
	return (
		<div
			{...props}
			data-slot="group-content"
			className={cn("ui-sidebar-group-content", className)}
		/>
	);
};

Sidebar.Menu = function SidebarMenu({ className, ...props }: Sidebar.MenuProps) {
	return <ul {...props} data-slot="menu" className={cn("ui-sidebar-menu", className)} />;
};

Sidebar.MenuItem = function SidebarMenuItem({ className, ...props }: Sidebar.MenuItemProps) {
	return <li {...props} data-slot="menu-item" className={cn("ui-sidebar-menu-item", className)} />;
};

Sidebar.MenuButton = function SidebarMenuButton({
	className,
	size = "md",
	active,
	tooltip,
	...props
}: Sidebar.MenuButtonProps) {
	let { state } = useSidebar();
	let isCollapsed = state === "collapsed";

	let button = (
		<AriaButton
			{...props}
			data-slot="menu-button"
			data-size={size}
			data-active={active || undefined}
			className={cn("ui-sidebar-menu-button", className)}
		/>
	);

	// Show tooltip in collapsed icon mode
	if (tooltip && isCollapsed) {
		return (
			<AriaTooltipTrigger delay={0}>
				{button}
				<AriaTooltip placement="right" offset={8} className="ui-tooltip">
					{tooltip}
				</AriaTooltip>
			</AriaTooltipTrigger>
		);
	}

	return button;
};

Sidebar.MenuLink = function SidebarMenuLink({
	className,
	active,
	"aria-current": ariaCurrent,
	tooltip,
	...props
}: Sidebar.MenuLinkProps) {
	let { state } = useSidebar();
	let isCollapsed = state === "collapsed";
	let resolvedCurrent = ariaCurrent ?? (active ? "page" : undefined);

	let link = (
		<AriaLink
			{...props}
			aria-current={resolvedCurrent}
			data-slot="menu-link"
			data-active={active || undefined}
			className={cn("ui-sidebar-menu-button", className)}
		/>
	);

	// Show tooltip in collapsed icon mode
	if (tooltip && isCollapsed) {
		return (
			<AriaTooltipTrigger delay={0}>
				{link}
				<AriaTooltip placement="right" offset={8} className="ui-tooltip">
					{tooltip}
				</AriaTooltip>
			</AriaTooltipTrigger>
		);
	}

	return link;
};

Sidebar.MenuAction = function SidebarMenuAction({ className, ...props }: Sidebar.MenuActionProps) {
	return (
		<AriaButton
			{...props}
			data-slot="menu-action"
			className={cn("ui-sidebar-menu-action", className)}
		/>
	);
};

Sidebar.MenuBadge = function SidebarMenuBadge({ className, ...props }: Sidebar.MenuBadgeProps) {
	return (
		<span {...props} data-slot="menu-badge" className={cn("ui-sidebar-menu-badge", className)} />
	);
};

Sidebar.MenuSkeleton = function SidebarMenuSkeleton({
	className,
	showIcon = false,
	...props
}: Sidebar.MenuSkeletonProps) {
	// Generate a random width for variety
	let width = useMemo(() => `${Math.floor(Math.random() * 40) + 50}%`, []);

	return (
		<div {...props} data-slot="menu-skeleton" className={cn("ui-sidebar-menu-skeleton", className)}>
			{showIcon && <div className="ui-sidebar-menu-skeleton-icon" />}
			<div className="ui-sidebar-menu-skeleton-text" style={{ width }} />
		</div>
	);
};

Sidebar.MenuSub = function SidebarMenuSub({ className, ...props }: Sidebar.MenuSubProps) {
	return <ul {...props} data-slot="menu-sub" className={cn("ui-sidebar-menu-sub", className)} />;
};

Sidebar.MenuSubItem = function SidebarMenuSubItem({
	className,
	...props
}: Sidebar.MenuSubItemProps) {
	return (
		<li
			{...props}
			data-slot="menu-sub-item"
			className={cn("ui-sidebar-menu-sub-item", className)}
		/>
	);
};

Sidebar.MenuSubButton = function SidebarMenuSubButton({
	className,
	active,
	...props
}: Sidebar.MenuSubButtonProps) {
	return (
		<AriaButton
			{...props}
			data-slot="menu-sub-button"
			data-active={active || undefined}
			className={cn("ui-sidebar-menu-sub-button", className)}
		/>
	);
};

Sidebar.Nav = function SidebarNav({ className, ...props }: Sidebar.NavProps) {
	return <nav {...props} data-slot="nav" className={cn("ui-sidebar-nav", className)} />;
};

Sidebar.Item = function SidebarItem({
	className,
	color: colorProp,
	current,
	"aria-current": ariaCurrent,
	...props
}: Sidebar.ItemProps) {
	let color = useColor(colorProp);

	let resolvedAriaCurrent = ariaCurrent;
	if (current && resolvedAriaCurrent == null) {
		resolvedAriaCurrent = "page";
	}

	let isCurrent = Boolean(current);
	if (resolvedAriaCurrent != null) {
		isCurrent = resolvedAriaCurrent !== false && resolvedAriaCurrent !== "false";
	}

	return (
		<ColorProvider color={color}>
			<AriaLink
				{...props}
				aria-current={resolvedAriaCurrent}
				data-slot="item"
				data-color={color}
				data-current={isCurrent || undefined}
				className={cn("ui-sidebar-item", className)}
			/>
		</ColorProvider>
	);
};

Sidebar.Rail = function SidebarRail({ className, ...props }: Sidebar.RailProps) {
	let { toggleSidebar } = useSidebar();

	return (
		<AriaButton
			{...props}
			data-slot="rail"
			className={cn("ui-sidebar-rail", className)}
			onPress={toggleSidebar}
		/>
	);
};

Sidebar.Trigger = function SidebarTrigger({ className, onPress, ...props }: Sidebar.TriggerProps) {
	let { toggleSidebar, state } = useSidebar();

	return (
		<AriaButton
			{...props}
			data-slot="trigger"
			data-state={state}
			className={cn("ui-sidebar-trigger", className)}
			onPress={(event) => {
				toggleSidebar();
				onPress?.(event);
			}}
		/>
	);
};

Sidebar.Inset = function SidebarInset({ className, ...props }: Sidebar.InsetProps) {
	return <div {...props} data-slot="inset" className={cn("ui-sidebar-inset", className)} />;
};

Sidebar.Separator = function SidebarSeparator({ className, ...props }: Sidebar.SeparatorProps) {
	return <hr {...props} data-slot="separator" className={cn("ui-sidebar-separator", className)} />;
};
