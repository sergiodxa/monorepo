import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Link as AriaLink } from "react-aria-components";

export namespace Sidebar {
	export interface Props extends Omit<ComponentProps<"aside">, "className"> {
		className?: cn.ClassName;
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

	export interface NavProps extends Omit<ComponentProps<"nav">, "className"> {
		className?: cn.ClassName;
	}

	export type ItemColor = "primary" | "neutral" | "danger" | "warning" | "success";

	export interface ItemProps extends Omit<
		ComponentProps<typeof AriaLink>,
		"className" | "aria-current"
	> {
		className?: cn.ClassName;
		color?: ItemColor;
		current?: boolean;
		"aria-current"?: ComponentProps<"a">["aria-current"];
	}
}

export function Sidebar({ className, ...props }: Sidebar.Props) {
	return (
		<aside {...props} data-component="sidebar" className={classNames("ui-sidebar", className)} />
	);
}

Sidebar.Header = function SidebarHeader({ className, ...props }: Sidebar.HeaderProps) {
	return (
		<header {...props} data-slot="header" className={classNames("ui-sidebar-header", className)} />
	);
};

Sidebar.Content = function SidebarContent({ className, ...props }: Sidebar.ContentProps) {
	return (
		<div {...props} data-slot="content" className={classNames("ui-sidebar-content", className)} />
	);
};

Sidebar.Footer = function SidebarFooter({ className, ...props }: Sidebar.FooterProps) {
	return (
		<footer {...props} data-slot="footer" className={classNames("ui-sidebar-footer", className)} />
	);
};

Sidebar.Nav = function SidebarNav({ className, ...props }: Sidebar.NavProps) {
	return <nav {...props} data-slot="nav" className={classNames("ui-sidebar-nav", className)} />;
};

Sidebar.Item = function SidebarItem({
	className,
	color = "neutral",
	current,
	"aria-current": ariaCurrent,
	...props
}: Sidebar.ItemProps) {
	let resolvedAriaCurrent = ariaCurrent;
	if (current && resolvedAriaCurrent == null) {
		resolvedAriaCurrent = "page";
	}

	return (
		<AriaLink
			{...props}
			aria-current={resolvedAriaCurrent}
			data-slot="item"
			data-color={color}
			data-current={current || undefined}
			className={classNames("ui-sidebar-item", className)}
		/>
	);
};
