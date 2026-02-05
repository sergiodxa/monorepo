import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { TextField as AriaTextField } from "react-aria-components";

export namespace TextField {
	export interface Props extends Omit<ComponentProps<typeof AriaTextField>, "className"> {
		className?: cn.ClassName;
	}
}

export function TextField({ className, ...props }: TextField.Props) {
	return <AriaTextField {...props} className={classNames("ui-field-group", className)} />;
}
