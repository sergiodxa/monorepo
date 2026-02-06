import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Group as AriaGroup } from "react-aria-components";

export namespace Group {
	export interface Props extends Omit<ComponentProps<typeof AriaGroup>, "className"> {
		className?: cn.ClassName;
	}
}

export function Group({ className, ...props }: Group.Props) {
	return <AriaGroup {...props} className={cn("ui-group", className)} />;
}
