import type { ComponentProps } from "react";
import type { DateValue } from "react-aria-components";

import { cn } from "@pkg/cn";
import { CalendarIcon } from "lucide-react";
import {
	DatePicker as AriaDatePicker,
	DateRangePicker as AriaDateRangePicker,
	Button,
	DateInput,
	DateSegment,
	Dialog,
	Group,
} from "react-aria-components";

import { Calendar } from "./calendar";
import { Popover } from "./popover";

export namespace DatePicker {
	export interface Props<T extends DateValue> extends Omit<
		ComponentProps<typeof AriaDatePicker<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface RangePickerProps<T extends DateValue> extends Omit<
		ComponentProps<typeof AriaDateRangePicker<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface GroupProps extends Omit<ComponentProps<typeof Group>, "className"> {
		className?: cn.ClassName;
	}

	export interface ButtonProps extends Omit<
		ComponentProps<typeof Button>,
		"children" | "className"
	> {
		className?: cn.ClassName;
	}

	export interface TriggerProps {
		className?: cn.ClassName;
	}
}

export function DatePicker<T extends DateValue>({ className, ...props }: DatePicker.Props<T>) {
	return <AriaDatePicker {...props} className={cn("ui-date-picker", className)} />;
}

DatePicker.RangePicker = function DatePickerRangePicker<T extends DateValue>({
	className,
	...props
}: DatePicker.RangePickerProps<T>) {
	return <AriaDateRangePicker {...props} className={cn("ui-date-range-picker", className)} />;
};

DatePicker.Group = function DatePickerGroup({ className, ...props }: DatePicker.GroupProps) {
	return <Group {...props} className={cn("ui-date-picker-group", className)} />;
};

DatePicker.Button = function DatePickerButton({ className, ...props }: DatePicker.ButtonProps) {
	return (
		<Button {...props} className={cn("ui-date-picker-button", className)}>
			<CalendarIcon className="size-4" aria-hidden />
		</Button>
	);
};

/**
 * A convenient trigger that combines the date input field, button, and calendar popover.
 * Use this for a quick setup instead of composing individual pieces.
 */
DatePicker.Trigger = function DatePickerTrigger({ className }: DatePicker.TriggerProps) {
	return (
		<>
			<Group className={cn("ui-date-picker-group", className)}>
				<DateInput className="ui-date-field-input">
					{(segment) => <DateSegment segment={segment} className="ui-date-field-segment" />}
				</DateInput>
				<Button className="ui-date-picker-button">
					<CalendarIcon className="size-4" aria-hidden />
				</Button>
			</Group>
			<Popover>
				<Dialog>
					<Calendar>
						<Calendar.Header>
							<Calendar.PreviousButton />
							<Calendar.Heading />
							<Calendar.NextButton />
						</Calendar.Header>
						<Calendar.Grid>
							<Calendar.GridHeader>
								{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
							</Calendar.GridHeader>
							<Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
						</Calendar.Grid>
					</Calendar>
				</Dialog>
			</Popover>
		</>
	);
};
