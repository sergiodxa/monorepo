import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import {
	Cell as AriaCell,
	Column as AriaColumn,
	Row as AriaRow,
	Table as AriaTable,
	TableBody as AriaTableBody,
	TableHeader as AriaTableHeader,
} from "react-aria-components";

export function Table(props: ComponentProps<typeof AriaTable>) {
	return (
		<AriaTable
			{...props}
			className={cn(
				"w-full border-collapse rounded-lg overflow-hidden",
				"bg-neutral-100 dark:bg-neutral-900",
				"text-neutral-950 dark:text-neutral-50",
				"border border-neutral-300 dark:border-neutral-700",
				"shadow-sm shadow-neutral-300 dark:shadow-neutral-700",
				"divide-y divide-neutral-300 dark:divide-neutral-700",
			)}
		/>
	);
}

Table.Header = function Header<T extends object>(props: ComponentProps<typeof AriaTableHeader<T>>) {
	return (
		<AriaTableHeader<T>
			{...props}
			className={cn("[&_th]:last-of-type::rounded-rt-lg [&_th]:first-of-type:rounded-lt-lg")}
		/>
	);
};

export enum ColumnAlignment {
	Left = "left",
	Center = "center",
	Right = "right",
}

Table.Column = function Column({
	align = ColumnAlignment.Left,
	...props
}: ComponentProps<typeof AriaColumn> & {
	align?: ColumnAlignment;
}) {
	return (
		<AriaColumn
			{...props}
			className={cn("text-sm font-medium leading-none p-4", {
				"text-left": align === ColumnAlignment.Left,
				"text-center": align === ColumnAlignment.Center,
				"text-right": align === ColumnAlignment.Right,
			})}
		/>
	);
};

Table.Body = function Body<T extends object>(props: ComponentProps<typeof AriaTableBody<T>>) {
	return (
		<AriaTableBody<T>
			{...props}
			className={cn("divide-y divide-neutral-300 dark:divide-neutral-700", props.className)}
		/>
	);
};

Table.Row = function Row(props: ComponentProps<typeof AriaRow>) {
	return (
		<AriaRow
			{...props}
			className={cn("odd:bg-neutral-50 dark:odd:bg-neutral-800", props.className)}
		/>
	);
};

Table.Cell = function Cell(props: ComponentProps<typeof AriaCell>) {
	return <AriaCell {...props} className={cn("p-4 py-2", props.className)} />;
};
