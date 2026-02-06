import type { ComponentProps } from "react";
import type { DateValue } from "react-aria-components";

import { cn } from "@pkg/cn";
import {
	DateField as AriaDateField,
	DateInput as AriaDateInput,
	DateSegment as AriaDateSegment,
} from "react-aria-components";

export namespace DateField {
	export interface Props<T extends DateValue> extends Omit<
		ComponentProps<typeof AriaDateField<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface InputProps extends Omit<ComponentProps<typeof AriaDateInput>, "className"> {
		className?: cn.ClassName;
	}

	export interface SegmentProps extends Omit<ComponentProps<typeof AriaDateSegment>, "className"> {
		className?: cn.ClassName;
	}
}

export function DateField<T extends DateValue>({ className, ...props }: DateField.Props<T>) {
	return <AriaDateField {...props} className={cn("ui-date-field", className)} />;
}

DateField.Input = function DateFieldInput({ className, ...props }: DateField.InputProps) {
	return <AriaDateInput {...props} className={cn("ui-date-input", className)} />;
};

DateField.Segment = function DateFieldSegment({ className, ...props }: DateField.SegmentProps) {
	return <AriaDateSegment {...props} className={cn("ui-date-segment", className)} />;
};
