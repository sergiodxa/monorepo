import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { RadioGroup as AriaRadioGroup, Radio as AriaRadio } from "react-aria-components";

export namespace RadioGroup {
	export interface Props extends Omit<ComponentProps<typeof AriaRadioGroup>, "className"> {
		className?: cn.ClassName;
	}
}

export function RadioGroup({ className, ...props }: RadioGroup.Props) {
	return <AriaRadioGroup {...props} className={cn("ui-radio-group", className)} />;
}

export namespace Radio {
	export interface Props extends Omit<ComponentProps<typeof AriaRadio>, "className"> {
		className?: cn.ClassName;
	}
}

export function Radio({ className, children, value, ...props }: Radio.Props) {
	return (
		<AriaRadio {...props} value={value} className={cn("ui-radio", className)}>
			{(renderProps) => (
				<>
					<span className="ui-radio-indicator" />
					{typeof children === "function" ? children(renderProps) : children}
				</>
			)}
		</AriaRadio>
	);
}
