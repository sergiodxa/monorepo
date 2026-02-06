import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Separator as AriaSeparator } from "react-aria-components";

export namespace Separator {
	export interface Props extends Omit<ComponentProps<typeof AriaSeparator>, "className"> {
		className?: cn.ClassName;
	}
}

export function Separator({ className, ...props }: Separator.Props) {
	return <AriaSeparator {...props} className={cn("ui-separator", className)} />;
}
