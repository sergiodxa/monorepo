import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import {
	Table as AriaTable,
	TableHeader as AriaTableHeader,
	TableBody as AriaTableBody,
	Column as AriaColumn,
	Row as AriaRow,
	Cell as AriaCell,
	ResizableTableContainer as AriaResizableTableContainer,
	ColumnResizer as AriaColumnResizer,
	TableLoadMoreItem as AriaTableLoadMoreItem,
} from "react-aria-components";

export namespace Table {
	export interface Props extends Omit<ComponentProps<typeof AriaTable>, "className"> {
		className?: cn.ClassName;
	}

	export interface HeaderProps<T extends object> extends Omit<
		ComponentProps<typeof AriaTableHeader<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface BodyProps<T extends object> extends Omit<
		ComponentProps<typeof AriaTableBody<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export type ColumnAlign = "left" | "center" | "right";

	export interface ColumnProps extends Omit<ComponentProps<typeof AriaColumn>, "className"> {
		className?: cn.ClassName;
		/** Text alignment within the column */
		align?: ColumnAlign;
	}

	export interface RowProps<T extends object> extends Omit<
		ComponentProps<typeof AriaRow<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface CellProps extends Omit<ComponentProps<typeof AriaCell>, "className"> {
		className?: cn.ClassName;
	}

	export interface ResizableContainerProps extends Omit<
		ComponentProps<typeof AriaResizableTableContainer>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface ColumnResizerProps extends Omit<
		ComponentProps<typeof AriaColumnResizer>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface LoadMoreItemProps extends Omit<
		ComponentProps<typeof AriaTableLoadMoreItem>,
		"className"
	> {
		className?: cn.ClassName;
	}
}

export function Table({ className, ...props }: Table.Props) {
	return <AriaTable {...props} className={classNames("ui-table", className)} />;
}

Table.Header = function TableHeader<T extends object>({
	className,
	...props
}: Table.HeaderProps<T>) {
	return <AriaTableHeader {...props} className={classNames("ui-table-header", className)} />;
};

Table.Body = function TableBody<T extends object>({ className, ...props }: Table.BodyProps<T>) {
	return <AriaTableBody {...props} className={classNames("ui-table-body", className)} />;
};

Table.Column = function TableColumn({ className, align, ...props }: Table.ColumnProps) {
	return (
		<AriaColumn
			{...props}
			className={classNames("ui-column", className)}
			data-align={align}
			data-allows-sorting={props.allowsSorting || undefined}
		/>
	);
};

Table.Row = function TableRow<T extends object>({ className, ...props }: Table.RowProps<T>) {
	return <AriaRow {...props} className={classNames("ui-row", className)} />;
};

Table.Cell = function TableCell({ className, ...props }: Table.CellProps) {
	return <AriaCell {...props} className={classNames("ui-cell", className)} />;
};

Table.ResizableContainer = function TableResizableContainer({
	className,
	...props
}: Table.ResizableContainerProps) {
	return (
		<AriaResizableTableContainer
			{...props}
			className={classNames("ui-table-resizable-container", className)}
		/>
	);
};

Table.ColumnResizer = function TableColumnResizer({
	className,
	...props
}: Table.ColumnResizerProps) {
	return <AriaColumnResizer {...props} className={classNames("ui-column-resizer", className)} />;
};

Table.LoadMoreItem = function TableLoadMoreItem({ className, ...props }: Table.LoadMoreItemProps) {
	return (
		<AriaTableLoadMoreItem
			{...props}
			className={classNames("ui-table-load-more-item", className)}
		/>
	);
};
