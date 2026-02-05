import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import {
	Menu as AriaMenu,
	MenuItem as AriaMenuItem,
	MenuTrigger as AriaMenuTrigger,
	Popover as AriaPopover,
	Separator as AriaSeparator,
} from "react-aria-components";

export function Menu(props: ComponentProps<typeof AriaMenu>) {
	return <AriaMenu {...props} className={cn("flex flex-col gap-0.5 p-1", props.className)} />;
}

Menu.Trigger = AriaMenuTrigger;

Menu.Popover = function Popover(props: ComponentProps<typeof AriaPopover>) {
	return (
		<AriaPopover
			{...props}
			style={{ minWidth: "var(--trigger-width)" }}
			className={cn(
				"rounded-lg",
				"border border-neutral-300 shadow shadow-neutral-300",
				"bg-neutral-50 text-neutral-950",
				"dark:border-neutral-700 dark:shadow-neutral-700",
				"dark:bg-neutral-950 dark:text-neutral-50",
				props.className,
			)}
		/>
	);
};

Menu.Item = function MenuItem(props: ComponentProps<typeof AriaMenuItem>) {
	return (
		<AriaMenuItem
			{...props}
			className={cn(
				// Default
				"flex items-center justify-start gap-2",
				"cursor-default rounded p-2 text-sm",
				// Selected
				"data-[selected]:after:content-['✓']",
				// Hovered
				"data-[hovered]:bg-primary-100 data-[hovered]:text-primary-900",
				"dark:data-[hovered]:bg-primary-800 dark:data-[hovered]:text-primary-50",
				// Focused
				"data-[focused]:bg-primary-100 data-[focused]:text-primary-900",
				"dark:data-[focused]:bg-primary-800 dark:data-[focused]:text-primary-50",
				// Disabled
				"data-[disabled]:cursor-not-allowed data-[disabled]:text-neutral-400",
				"dark:data-[disabled]:text-neutral-600",
				props.className,
			)}
		/>
	);
};

Menu.Separator = function Separator(props: ComponentProps<typeof AriaSeparator>) {
	return (
		<AriaSeparator
			{...props}
			className={cn("-mx-1 my-1 h-px bg-neutral-300 dark:bg-neutral-700", props.className)}
		/>
	);
};
