import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import {
	Menu as AriaMenu,
	MenuItem as AriaMenuItem,
	MenuTrigger,
	MenuSection as AriaMenuSection,
	SubmenuTrigger as AriaSubmenuTrigger,
	Separator as AriaSeparator,
} from "react-aria-components";

export namespace Menu {
	export interface Props<T extends object> extends Omit<
		ComponentProps<typeof AriaMenu<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface ItemProps extends Omit<ComponentProps<typeof AriaMenuItem>, "className"> {
		className?: cn.ClassName;
		danger?: boolean;
	}

	export interface SectionProps<T extends object> extends Omit<
		ComponentProps<typeof AriaMenuSection<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface SubmenuTriggerProps extends ComponentProps<typeof AriaSubmenuTrigger> {}

	export interface SeparatorProps extends Omit<ComponentProps<typeof AriaSeparator>, "className"> {
		className?: cn.ClassName;
	}
}

export function Menu<T extends object>({ className, ...props }: Menu.Props<T>) {
	return <AriaMenu {...props} className={classNames("ui-menu", className)} />;
}

Menu.Trigger = MenuTrigger;

Menu.Item = function MenuItem({ className, danger, ...props }: Menu.ItemProps) {
	return (
		<AriaMenuItem
			{...props}
			className={classNames("ui-menu-item", className)}
			data-danger={danger || undefined}
		/>
	);
};

Menu.Section = function MenuSection<T extends object>({
	className,
	...props
}: Menu.SectionProps<T>) {
	return <AriaMenuSection {...props} className={classNames("ui-menu-section", className)} />;
};

/**
 * SubmenuTrigger wraps a Menu.Item to open a nested submenu.
 * Note: This component does not accept className - style the wrapped Menu.Item instead.
 */
Menu.SubmenuTrigger = AriaSubmenuTrigger;

Menu.Separator = function MenuSeparator({ className, ...props }: Menu.SeparatorProps) {
	return <AriaSeparator {...props} className={classNames("ui-menu-separator", className)} />;
};
