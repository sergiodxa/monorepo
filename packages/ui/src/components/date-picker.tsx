import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";
import type { DateValue } from "react-aria-components";

import { cn as classNames } from "@pkg/cn";
import { CalendarIcon } from "lucide-react";
import {
	DatePicker as AriaDatePicker,
	DateRangePicker as AriaDateRangePicker,
	Button,
	Group,
} from "react-aria-components";

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
}

export function DatePicker<T extends DateValue>({ className, ...props }: DatePicker.Props<T>) {
	return <AriaDatePicker {...props} className={classNames("ui-date-picker", className)} />;
}

DatePicker.RangePicker = function DatePickerRangePicker<T extends DateValue>({
	className,
	...props
}: DatePicker.RangePickerProps<T>) {
	return (
		<AriaDateRangePicker {...props} className={classNames("ui-date-range-picker", className)} />
	);
};

DatePicker.Group = function DatePickerGroup({ className, ...props }: DatePicker.GroupProps) {
	return <Group {...props} className={classNames("ui-date-picker-group", className)} />;
};

DatePicker.Button = function DatePickerButton({ className, ...props }: DatePicker.ButtonProps) {
	return (
		<Button {...props} className={classNames("ui-date-picker-button", className)}>
			<CalendarIcon className="size-4" aria-hidden />
		</Button>
	);
};
