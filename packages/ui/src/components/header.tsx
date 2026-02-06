import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Header as AriaHeader } from "react-aria-components";

export namespace Header {
	export interface Props extends Omit<ComponentProps<typeof AriaHeader>, "className"> {
		className?: cn.ClassName;
	}
}

export function Header({ className, ...props }: Header.Props) {
	return <AriaHeader {...props} className={cn("ui-header", className)} />;
}
