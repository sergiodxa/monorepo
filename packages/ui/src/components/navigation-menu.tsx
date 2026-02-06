import type { cn } from "@pkg/cn";
import type { ComponentProps, ReactNode } from "react";

import { cn as classNames } from "@pkg/cn";
import { Children, isValidElement } from "react";
import {
	Button as AriaButton,
	Link as AriaLink,
	MenuTrigger,
	Toolbar as AriaToolbar,
} from "react-aria-components";

import { Popover } from "./popover";

export namespace NavigationMenu {
	export interface Props extends Omit<ComponentProps<"nav">, "className"> {
		className?: cn.ClassName;
	}

	export interface ListProps extends Omit<ComponentProps<typeof AriaToolbar>, "className"> {
		className?: cn.ClassName;
	}

	export interface ItemProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
		children?: ReactNode;
	}

	export interface TriggerProps extends Omit<ComponentProps<typeof AriaButton>, "className"> {
		className?: cn.ClassName;
	}

	export interface ContentProps extends Omit<ComponentProps<typeof Popover>, "className"> {
		className?: cn.ClassName;
	}

	export interface LinkProps extends Omit<ComponentProps<typeof AriaLink>, "className"> {
		className?: cn.ClassName;
	}

	export interface ViewportProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}
}

export function NavigationMenu({ className, ...props }: NavigationMenu.Props) {
	return <nav {...props} className={classNames("ui-navigation-menu", className)} />;
}

NavigationMenu.List = function NavigationMenuList({
	className,
	orientation,
	...props
}: NavigationMenu.ListProps) {
	return (
		<AriaToolbar
			{...props}
			orientation={orientation}
			className={classNames("ui-navigation-menu-list", className)}
			data-orientation={orientation}
		/>
	);
};

NavigationMenu.Trigger = function NavigationMenuTrigger({
	className,
	...props
}: NavigationMenu.TriggerProps) {
	return <AriaButton {...props} className={classNames("ui-navigation-menu-trigger", className)} />;
};

NavigationMenu.Content = function NavigationMenuContent({
	className,
	...props
}: NavigationMenu.ContentProps) {
	return <Popover {...props} className={classNames("ui-navigation-menu-content", className)} />;
};

NavigationMenu.Item = function NavigationMenuItem({
	className,
	children,
	...props
}: NavigationMenu.ItemProps) {
	let childArray = Children.toArray(children);
	let hasContent = childArray.some(
		(child) => isValidElement(child) && child.type === NavigationMenu.Content,
	);

	return (
		<div
			{...props}
			className={classNames("ui-navigation-menu-item", className)}
			data-has-content={hasContent || undefined}
		>
			{hasContent ? <MenuTrigger>{children}</MenuTrigger> : children}
		</div>
	);
};

NavigationMenu.Link = function NavigationMenuLink({
	className,
	...props
}: NavigationMenu.LinkProps) {
	return <AriaLink {...props} className={classNames("ui-navigation-menu-link", className)} />;
};

NavigationMenu.Viewport = function NavigationMenuViewport({
	className,
	...props
}: NavigationMenu.ViewportProps) {
	return <div {...props} className={classNames("ui-navigation-menu-viewport", className)} />;
};
