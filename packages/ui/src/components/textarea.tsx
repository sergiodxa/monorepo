import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { TextArea as AriaTextArea } from "react-aria-components";

export namespace TextArea {
	export interface Props extends Omit<ComponentProps<typeof AriaTextArea>, "className"> {
		className?: cn.ClassName;
	}
}

export function TextArea({ className, ...props }: TextArea.Props) {
	return <AriaTextArea {...props} className={cn("ui-textarea", className)} />;
}
