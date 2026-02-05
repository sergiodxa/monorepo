import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Group as AriaGroup } from "react-aria-components";

export namespace Group {
	export interface Props extends Omit<ComponentProps<typeof AriaGroup>, "className"> {
		className?: cn.ClassName;
	}
}

export function Group({ className, ...props }: Group.Props) {
	return <AriaGroup {...props} className={classNames("ui-group", className)} />;
}
