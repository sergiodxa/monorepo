import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Popover as AriaPopover } from "react-aria-components";

export namespace Popover {
	export interface Props extends Omit<ComponentProps<typeof AriaPopover>, "className"> {
		className?: cn.ClassName;
	}
}

export function Popover({ className, ...props }: Popover.Props) {
	return <AriaPopover {...props} className={cn("ui-popover", className)} />;
}
