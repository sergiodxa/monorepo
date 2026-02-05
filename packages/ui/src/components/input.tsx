import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Input as AriaInput } from "react-aria-components";

export namespace Input {
	export interface Props extends Omit<ComponentProps<typeof AriaInput>, "className"> {
		className?: cn.ClassName;
	}
}

export function Input({ className, ...props }: Input.Props) {
	return <AriaInput {...props} className={classNames("ui-input", className)} />;
}
