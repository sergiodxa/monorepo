import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { GripVerticalIcon } from "lucide-react";
import {
	GridList as AriaGridList,
	GridListItem as AriaGridListItem,
	GridListSection as AriaGridListSection,
	GridListHeader as AriaGridListHeader,
	GridListLoadMoreItem as AriaGridListLoadMoreItem,
	Button,
} from "react-aria-components";

export namespace GridList {
	export interface Props<T extends object> extends Omit<
		ComponentProps<typeof AriaGridList<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface ItemProps extends Omit<ComponentProps<typeof AriaGridListItem>, "className"> {
		className?: cn.ClassName;
	}

	export interface SectionProps<T extends object> extends Omit<
		ComponentProps<typeof AriaGridListSection<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface HeaderProps extends Omit<
		ComponentProps<typeof AriaGridListHeader>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface LoadMoreItemProps extends Omit<
		ComponentProps<typeof AriaGridListLoadMoreItem>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface DragHandleProps extends Omit<
		ComponentProps<typeof Button>,
		"className" | "slot"
	> {
		className?: cn.ClassName;
	}
}

export function GridList<T extends object>({ className, ...props }: GridList.Props<T>) {
	return <AriaGridList {...props} className={classNames("ui-grid-list", className)} />;
}

GridList.Item = function GridListItem({ className, ...props }: GridList.ItemProps) {
	return <AriaGridListItem {...props} className={classNames("ui-grid-list-item", className)} />;
};

GridList.Section = function GridListSection<T extends object>({
	className,
	...props
}: GridList.SectionProps<T>) {
	return (
		<AriaGridListSection {...props} className={classNames("ui-grid-list-section", className)} />
	);
};

GridList.Header = function GridListHeader({ className, ...props }: GridList.HeaderProps) {
	return <AriaGridListHeader {...props} className={classNames("ui-grid-list-header", className)} />;
};

GridList.LoadMoreItem = function GridListLoadMoreItem({
	className,
	...props
}: GridList.LoadMoreItemProps) {
	return (
		<AriaGridListLoadMoreItem
			{...props}
			className={classNames("ui-grid-list-load-more-item", className)}
		/>
	);
};

GridList.DragHandle = function GridListDragHandle({
	className,
	...props
}: GridList.DragHandleProps) {
	return (
		<Button {...props} slot="drag" className={classNames("ui-grid-list-drag-handle", className)}>
			<GripVerticalIcon className="size-4" aria-hidden />
		</Button>
	);
};
