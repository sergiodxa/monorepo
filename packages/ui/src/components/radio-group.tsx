import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { RadioGroup as AriaRadioGroup, Radio as AriaRadio } from "react-aria-components";

export namespace RadioGroup {
	export interface Props extends Omit<ComponentProps<typeof AriaRadioGroup>, "className"> {
		className?: cn.ClassName;
	}
}

export function RadioGroup({ className, ...props }: RadioGroup.Props) {
	return <AriaRadioGroup {...props} className={classNames("ui-radio-group", className)} />;
}

export namespace Radio {
	export interface Props extends Omit<ComponentProps<typeof AriaRadio>, "className"> {
		className?: cn.ClassName;
	}
}

export function Radio({ className, children, ...props }: Radio.Props) {
	return (
		<AriaRadio {...props} className={classNames("ui-radio", className)}>
			{(renderProps) => (
				<>
					<span className="ui-radio-indicator" />
					{typeof children === "function" ? children(renderProps) : children}
				</>
			)}
		</AriaRadio>
	);
}
