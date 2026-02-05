import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { CheckboxGroup as AriaCheckboxGroup } from "react-aria-components";

export namespace CheckboxGroup {
	export interface Props extends Omit<ComponentProps<typeof AriaCheckboxGroup>, "className"> {
		className?: cn.ClassName;
	}
}

export function CheckboxGroup({ className, ...props }: CheckboxGroup.Props) {
	return <AriaCheckboxGroup {...props} className={classNames("ui-checkbox-group", className)} />;
}
