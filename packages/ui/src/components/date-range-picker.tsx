import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";
import type { DateValue } from "react-aria-components";

import { cn as classNames } from "@pkg/cn";
import { CalendarIcon } from "lucide-react";
import {
	DateRangePicker as AriaDateRangePicker,
	DateInput as AriaDateInput,
	DateSegment as AriaDateSegment,
	Group,
	Button,
	Dialog,
} from "react-aria-components";

export namespace DateRangePicker {
	export interface Props<T extends DateValue> extends Omit<
		ComponentProps<typeof AriaDateRangePicker<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface GroupProps extends Omit<ComponentProps<typeof Group>, "className"> {
		className?: cn.ClassName;
	}

	export interface InputProps extends Omit<ComponentProps<typeof AriaDateInput>, "className"> {
		className?: cn.ClassName;
	}

	export interface SegmentProps extends Omit<ComponentProps<typeof AriaDateSegment>, "className"> {
		className?: cn.ClassName;
	}

	export interface ButtonProps extends Omit<ComponentProps<typeof Button>, "className"> {
		className?: cn.ClassName;
	}

	export interface DialogProps extends Omit<ComponentProps<typeof Dialog>, "className"> {
		className?: cn.ClassName;
	}
}

export function DateRangePicker<T extends DateValue>({
	className,
	...props
}: DateRangePicker.Props<T>) {
	return (
		<AriaDateRangePicker {...props} className={classNames("ui-date-range-picker", className)} />
	);
}

DateRangePicker.Group = function DateRangePickerGroup({
	className,
	...props
}: DateRangePicker.GroupProps) {
	return <Group {...props} className={classNames("ui-date-range-picker-group", className)} />;
};

DateRangePicker.StartInput = function DateRangePickerStartInput({
	className,
	...props
}: DateRangePicker.InputProps) {
	return (
		<AriaDateInput {...props} slot="start" className={classNames("ui-date-input", className)}>
			{(segment) => <AriaDateSegment segment={segment} className="ui-date-segment" />}
		</AriaDateInput>
	);
};

DateRangePicker.EndInput = function DateRangePickerEndInput({
	className,
	...props
}: DateRangePicker.InputProps) {
	return (
		<AriaDateInput {...props} slot="end" className={classNames("ui-date-input", className)}>
			{(segment) => <AriaDateSegment segment={segment} className="ui-date-segment" />}
		</AriaDateInput>
	);
};

DateRangePicker.Button = function DateRangePickerButton({
	className,
	children,
	...props
}: DateRangePicker.ButtonProps) {
	return (
		<Button {...props} className={classNames("ui-date-picker-button", className)}>
			{children ?? <CalendarIcon className="size-4" aria-hidden />}
		</Button>
	);
};

DateRangePicker.Dialog = function DateRangePickerDialog({
	className,
	...props
}: DateRangePicker.DialogProps) {
	return <Dialog {...props} className={classNames("ui-date-picker-dialog", className)} />;
};
