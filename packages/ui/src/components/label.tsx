import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Label as AriaLabel } from "react-aria-components";

export namespace Label {
	export interface Props extends Omit<ComponentProps<typeof AriaLabel>, "className"> {
		className?: cn.ClassName;
	}
}

export function Label({ className, ...props }: Label.Props) {
	return <AriaLabel {...props} className={cn("ui-label", className)} />;
}
