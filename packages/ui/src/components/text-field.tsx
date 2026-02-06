import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { TextField as AriaTextField } from "react-aria-components";

export namespace TextField {
	export interface Props extends Omit<ComponentProps<typeof AriaTextField>, "className"> {
		className?: cn.ClassName;
	}
}

export function TextField({ className, ...props }: TextField.Props) {
	return <AriaTextField {...props} className={cn("ui-field-group", className)} />;
}
