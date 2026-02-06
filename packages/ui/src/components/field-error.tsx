import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { FieldError as AriaFieldError } from "react-aria-components";

export namespace FieldError {
	export interface Props extends Omit<ComponentProps<typeof AriaFieldError>, "className"> {
		className?: cn.ClassName;
	}
}

export function FieldError({ className, ...props }: FieldError.Props) {
	return <AriaFieldError {...props} className={cn("ui-field-error", className)} />;
}
