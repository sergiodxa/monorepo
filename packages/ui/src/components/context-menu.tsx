import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import {
	Header,
	Menu as AriaMenu,
	MenuItem as AriaMenuItem,
	MenuSection as AriaMenuSection,
	MenuTrigger as AriaMenuTrigger,
	Pressable,
	Separator as AriaSeparator,
	SubmenuTrigger as AriaSubmenuTrigger,
} from "react-aria-components";

import { Popover } from "./popover";

export namespace ContextMenu {
	export interface Props extends Omit<ComponentProps<typeof AriaMenuTrigger>, "trigger"> {}

	export interface TriggerProps extends Omit<ComponentProps<typeof Pressable>, "children"> {
		children: ComponentProps<typeof Pressable>["children"];
	}

	export interface ContentProps<T extends object> extends Omit<
		ComponentProps<typeof AriaMenu<T>>,
		"className"
	> {
		className?: cn.ClassNameRecord<"menu" | "popover">;
		popoverProps?: Omit<ComponentProps<typeof Popover>, "children" | "className">;
	}

	export interface ItemProps extends Omit<ComponentProps<typeof AriaMenuItem>, "className"> {
		className?: cn.ClassName;
		danger?: boolean;
	}

	export interface GroupProps<T extends object> extends Omit<
		ComponentProps<typeof AriaMenuSection<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface LabelProps extends Omit<ComponentProps<typeof Header>, "className"> {
		className?: cn.ClassName;
	}

	export interface SeparatorProps extends Omit<ComponentProps<typeof AriaSeparator>, "className"> {
		className?: cn.ClassName;
	}

	export interface SubProps extends ComponentProps<typeof AriaSubmenuTrigger> {}

	export interface ShortcutProps extends Omit<ComponentProps<"span">, "className"> {
		className?: cn.ClassName;
	}
}

export function ContextMenu(props: ContextMenu.Props) {
	let contextMenuTrigger = "contextMenu" as ComponentProps<typeof AriaMenuTrigger>["trigger"];
	return <AriaMenuTrigger {...props} trigger={contextMenuTrigger} />;
}

ContextMenu.Trigger = function ContextMenuTrigger({
	children,
	...props
}: ContextMenu.TriggerProps) {
	return <Pressable {...props}>{children}</Pressable>;
};

ContextMenu.Content = function ContextMenuContent<T extends object>({
	className,
	popoverProps,
	...props
}: ContextMenu.ContentProps<T>) {
	return (
		<Popover {...popoverProps} className={cn("ui-context-menu-content", className?.popover)}>
			<AriaMenu {...props} className={cn("ui-context-menu", className?.menu)} />
		</Popover>
	);
};

ContextMenu.Item = function ContextMenuItem({
	className,
	danger,
	...props
}: ContextMenu.ItemProps) {
	return (
		<AriaMenuItem
			{...props}
			className={cn("ui-context-menu-item", className)}
			data-danger={danger || undefined}
		/>
	);
};

ContextMenu.Group = function ContextMenuGroup<T extends object>({
	className,
	...props
}: ContextMenu.GroupProps<T>) {
	return <AriaMenuSection {...props} className={cn("ui-context-menu-group", className)} />;
};

ContextMenu.Label = function ContextMenuLabel({ className, ...props }: ContextMenu.LabelProps) {
	return <Header {...props} className={cn("ui-context-menu-label", className)} />;
};

ContextMenu.Separator = function ContextMenuSeparator({
	className,
	...props
}: ContextMenu.SeparatorProps) {
	return <AriaSeparator {...props} className={cn("ui-context-menu-separator", className)} />;
};

ContextMenu.Sub = AriaSubmenuTrigger;

ContextMenu.SubTrigger = function ContextMenuSubTrigger({
	className,
	danger,
	...props
}: ContextMenu.ItemProps) {
	return (
		<AriaMenuItem
			{...props}
			className={cn("ui-context-menu-sub-trigger", className)}
			data-danger={danger || undefined}
		/>
	);
};

ContextMenu.SubContent = function ContextMenuSubContent<T extends object>({
	className,
	popoverProps,
	...props
}: ContextMenu.ContentProps<T>) {
	return (
		<Popover {...popoverProps} className={cn("ui-context-menu-sub-content", className?.popover)}>
			<AriaMenu {...props} className={cn("ui-context-menu", className?.menu)} />
		</Popover>
	);
};

ContextMenu.CheckboxItem = ContextMenu.Item;
ContextMenu.RadioItem = ContextMenu.Item;
ContextMenu.RadioGroup = ContextMenu.Group;

ContextMenu.Shortcut = function ContextMenuShortcut({
	className,
	...props
}: ContextMenu.ShortcutProps) {
	return <span {...props} className={cn("ui-context-menu-shortcut", className)} />;
};
