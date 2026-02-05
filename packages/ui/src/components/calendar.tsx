import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";
import type { DateValue } from "react-aria-components";

import { cn as classNames } from "@pkg/cn";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
	Calendar as AriaCalendar,
	CalendarCell as AriaCalendarCell,
	CalendarGrid as AriaCalendarGrid,
	CalendarGridHeader as AriaCalendarGridHeader,
	CalendarGridBody as AriaCalendarGridBody,
	CalendarHeaderCell as AriaCalendarHeaderCell,
	Heading,
	Button,
	useLocale,
} from "react-aria-components";

export namespace Calendar {
	export interface Props<T extends DateValue> extends Omit<
		ComponentProps<typeof AriaCalendar<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface HeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "className"> {
		className?: cn.ClassName;
	}

	export interface PreviousButtonProps extends Omit<
		ComponentProps<typeof Button>,
		"slot" | "className"
	> {
		className?: cn.ClassName;
	}

	export interface NextButtonProps extends Omit<
		ComponentProps<typeof Button>,
		"slot" | "className"
	> {
		className?: cn.ClassName;
	}

	export interface HeadingProps extends Omit<ComponentProps<typeof Heading>, "className"> {
		className?: cn.ClassName;
	}

	export interface GridProps extends Omit<ComponentProps<typeof AriaCalendarGrid>, "className"> {
		className?: cn.ClassName;
	}

	export interface GridHeaderProps extends Omit<
		ComponentProps<typeof AriaCalendarGridHeader>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface HeaderCellProps extends Omit<
		ComponentProps<typeof AriaCalendarHeaderCell>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface GridBodyProps extends Omit<
		ComponentProps<typeof AriaCalendarGridBody>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface CellProps extends Omit<ComponentProps<typeof AriaCalendarCell>, "className"> {
		className?: cn.ClassName;
	}
}

export function Calendar<T extends DateValue>({ className, ...props }: Calendar.Props<T>) {
	return <AriaCalendar {...props} className={classNames("ui-calendar", className)} />;
}

Calendar.Header = function CalendarHeader({ className, children, ...props }: Calendar.HeaderProps) {
	return (
		<header {...props} className={classNames("ui-calendar-header", className)}>
			{children}
		</header>
	);
};

Calendar.PreviousButton = function CalendarPreviousButton({
	className,
	children,
	...props
}: Calendar.PreviousButtonProps) {
	let { direction } = useLocale();
	let Icon = direction === "rtl" ? ChevronRightIcon : ChevronLeftIcon;

	return (
		<Button {...props} slot="previous" className={classNames("ui-calendar-nav-button", className)}>
			{children ?? <Icon className="size-4" aria-hidden />}
		</Button>
	);
};

Calendar.NextButton = function CalendarNextButton({
	className,
	children,
	...props
}: Calendar.NextButtonProps) {
	let { direction } = useLocale();
	let Icon = direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;

	return (
		<Button {...props} slot="next" className={classNames("ui-calendar-nav-button", className)}>
			{children ?? <Icon className="size-4" aria-hidden />}
		</Button>
	);
};

Calendar.Heading = function CalendarHeading({ className, ...props }: Calendar.HeadingProps) {
	return <Heading {...props} className={classNames("ui-calendar-heading", className)} />;
};

Calendar.Grid = function CalendarGrid({ className, ...props }: Calendar.GridProps) {
	return <AriaCalendarGrid {...props} className={classNames("ui-calendar-grid", className)} />;
};

Calendar.GridHeader = function CalendarGridHeader({
	className,
	...props
}: Calendar.GridHeaderProps) {
	return (
		<AriaCalendarGridHeader
			{...props}
			className={classNames("ui-calendar-grid-header", className)}
		/>
	);
};

Calendar.HeaderCell = function CalendarHeaderCell({
	className,
	...props
}: Calendar.HeaderCellProps) {
	return (
		<AriaCalendarHeaderCell
			{...props}
			className={classNames("ui-calendar-header-cell", className)}
		/>
	);
};

Calendar.GridBody = function CalendarGridBody({ className, ...props }: Calendar.GridBodyProps) {
	return (
		<AriaCalendarGridBody {...props} className={classNames("ui-calendar-grid-body", className)} />
	);
};

Calendar.Cell = function CalendarCell({ className, ...props }: Calendar.CellProps) {
	return <AriaCalendarCell {...props} className={classNames("ui-calendar-cell", className)} />;
};
