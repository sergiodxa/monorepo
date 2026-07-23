import type { ComponentProps, ReactElement } from "react";

import { cn } from "@pkg/cn";
import { createElement } from "react";
import { ChevronRightIcon } from "lucide-react";
import {
	Tree as AriaTree,
	TreeItem as AriaTreeItem,
	TreeItemContent as AriaTreeItemContent,
	TreeLoadMoreItem as AriaTreeLoadMoreItem,
	Button,
} from "react-aria-components";

export namespace Tree {
	export interface Props<T extends object> extends Omit<
		ComponentProps<typeof AriaTree<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface ItemProps<T extends object = object> extends Omit<
		ComponentProps<typeof AriaTreeItem<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface ItemContentProps extends ComponentProps<typeof AriaTreeItemContent> {}

	export interface LoadMoreItemProps extends Omit<
		ComponentProps<typeof AriaTreeLoadMoreItem>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface ExpandButtonProps extends Omit<
		ComponentProps<typeof Button>,
		"className" | "slot"
	> {
		className?: cn.ClassName;
	}
}

export function Tree<T extends object>({ className, ...props }: Tree.Props<T>) {
	return <AriaTree {...props} className={cn("ui-tree", className)} />;
}

Tree.Item = function TreeItem<T extends object>({ className, ...props }: Tree.ItemProps<T>) {
	return createElement(AriaTreeItem as never, {
		...props,
		className: cn("ui-tree-item", className),
	}) as ReactElement;
};

/**
 * TreeItemContent wraps the content of a tree item.
 * Note: This component does not accept className - use a wrapper div for custom styling.
 */
Tree.ItemContent = AriaTreeItemContent;

Tree.LoadMoreItem = function TreeLoadMoreItem({ className, ...props }: Tree.LoadMoreItemProps) {
	return <AriaTreeLoadMoreItem {...props} className={cn("ui-tree-load-more-item", className)} />;
};

Tree.ExpandButton = function TreeExpandButton({
	className,
	children,
	...props
}: Tree.ExpandButtonProps) {
	return (
		<Button {...props} slot="chevron" className={cn("ui-tree-expand-button", className)}>
			{children ?? <ChevronRightIcon className="size-4" aria-hidden />}
		</Button>
	);
};
