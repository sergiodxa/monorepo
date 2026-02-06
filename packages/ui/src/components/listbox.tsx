import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import {
	ListBox as AriaListBox,
	ListBoxItem as AriaListBoxItem,
	ListBoxSection as AriaListBoxSection,
	ListBoxLoadMoreItem as AriaListBoxLoadMoreItem,
} from "react-aria-components";

export namespace ListBox {
	export interface Props<T extends object> extends Omit<
		ComponentProps<typeof AriaListBox<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface ItemProps extends Omit<ComponentProps<typeof AriaListBoxItem>, "className"> {
		className?: cn.ClassName;
	}

	export interface SectionProps<T extends object> extends Omit<
		ComponentProps<typeof AriaListBoxSection<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface LoadMoreItemProps extends Omit<
		ComponentProps<typeof AriaListBoxLoadMoreItem>,
		"className"
	> {
		className?: cn.ClassName;
	}
}

export function ListBox<T extends object>({ className, ...props }: ListBox.Props<T>) {
	return <AriaListBox {...props} className={cn("ui-listbox", className)} />;
}

ListBox.Item = function ListBoxItem({ className, ...props }: ListBox.ItemProps) {
	return <AriaListBoxItem {...props} className={cn("ui-listbox-item", className)} />;
};

ListBox.Section = function ListBoxSection<T extends object>({
	className,
	...props
}: ListBox.SectionProps<T>) {
	return <AriaListBoxSection {...props} className={cn("ui-listbox-section", className)} />;
};

ListBox.LoadMoreItem = function ListBoxLoadMoreItem({
	className,
	...props
}: ListBox.LoadMoreItemProps) {
	return (
		<AriaListBoxLoadMoreItem {...props} className={cn("ui-listbox-load-more-item", className)} />
	);
};
