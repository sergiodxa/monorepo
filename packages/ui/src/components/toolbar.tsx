import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Toolbar as AriaToolbar } from "react-aria-components";

export namespace Toolbar {
	export interface Props extends Omit<ComponentProps<typeof AriaToolbar>, "className"> {
		className?: cn.ClassName;
	}
}

export function Toolbar({ className, ...props }: Toolbar.Props) {
	return <AriaToolbar {...props} className={cn("ui-toolbar", className)} />;
}
