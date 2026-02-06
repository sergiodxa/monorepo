import type { ComponentProps } from "react";
import type { TimeValue } from "react-aria-components";

import { cn } from "@pkg/cn";
import {
	TimeField as AriaTimeField,
	DateInput as AriaDateInput,
	DateSegment as AriaDateSegment,
} from "react-aria-components";

export namespace TimeField {
	export interface Props<T extends TimeValue> extends Omit<
		ComponentProps<typeof AriaTimeField<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface InputProps extends Omit<
		ComponentProps<typeof AriaDateInput>,
		"className" | "children"
	> {
		className?: cn.ClassName;
	}

	export interface SegmentProps extends Omit<ComponentProps<typeof AriaDateSegment>, "className"> {
		className?: cn.ClassName;
	}
}

export function TimeField<T extends TimeValue>({ className, ...props }: TimeField.Props<T>) {
	return <AriaTimeField {...props} className={cn("ui-time-field", className)} />;
}

TimeField.Input = function TimeFieldInput({ className, ...props }: TimeField.InputProps) {
	return (
		<AriaDateInput {...props} className={cn("ui-date-input", className)}>
			{(segment) => <AriaDateSegment segment={segment} className="ui-date-segment" />}
		</AriaDateInput>
	);
};

TimeField.Segment = function TimeFieldSegment({ className, ...props }: TimeField.SegmentProps) {
	return <AriaDateSegment {...props} className={cn("ui-date-segment", className)} />;
};
