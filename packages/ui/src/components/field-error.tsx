import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { FieldError as AriaFieldError } from "react-aria-components";

export namespace FieldError {
	export interface Props extends Omit<ComponentProps<typeof AriaFieldError>, "className"> {
		className?: cn.ClassName;
	}
}

export function FieldError({ className, ...props }: FieldError.Props) {
	return <AriaFieldError {...props} className={classNames("ui-field-error", className)} />;
}
