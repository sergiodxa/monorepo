import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Keyboard as AriaKeyboard } from "react-aria-components";

export namespace Keyboard {
	export interface Props extends Omit<ComponentProps<typeof AriaKeyboard>, "className"> {
		className?: cn.ClassName;
	}
}

export function Keyboard({ className, ...props }: Keyboard.Props) {
	return <AriaKeyboard {...props} className={cn("ui-keyboard", className)} />;
}
