import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Popover as AriaPopover } from "react-aria-components";

export namespace Popover {
	export interface Props extends Omit<ComponentProps<typeof AriaPopover>, "className"> {
		className?: cn.ClassName;
	}
}

export function Popover({ className, ...props }: Popover.Props) {
	return <AriaPopover {...props} className={classNames("ui-popover", className)} />;
}
