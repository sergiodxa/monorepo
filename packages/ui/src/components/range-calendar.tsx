import type { ComponentProps } from "react";
import type { DateValue } from "react-aria-components";

import { cn } from "@pkg/cn";
import { RangeCalendar as AriaRangeCalendar } from "react-aria-components";

export namespace RangeCalendar {
	export interface Props<T extends DateValue> extends Omit<
		ComponentProps<typeof AriaRangeCalendar<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}
}

/**
 * RangeCalendar displays a calendar for selecting a date range.
 *
 * Use with Calendar sub-components for composition:
 * @example
 * ```tsx
 * <RangeCalendar>
 *   <Calendar.Header>
 *     <Calendar.PreviousButton />
 *     <Calendar.Heading />
 *     <Calendar.NextButton />
 *   </Calendar.Header>
 *   <Calendar.Grid>
 *     <Calendar.GridHeader>
 *       {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
 *     </Calendar.GridHeader>
 *     <Calendar.GridBody>
 *       {(date) => <Calendar.Cell date={date} />}
 *     </Calendar.GridBody>
 *   </Calendar.Grid>
 * </RangeCalendar>
 * ```
 */
export function RangeCalendar<T extends DateValue>({
	className,
	...props
}: RangeCalendar.Props<T>) {
	return <AriaRangeCalendar {...props} className={cn("ui-range-calendar", className)} />;
}
