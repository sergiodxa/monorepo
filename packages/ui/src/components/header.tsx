import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Header as AriaHeader } from "react-aria-components";

export namespace Header {
	export interface Props extends Omit<ComponentProps<typeof AriaHeader>, "className"> {
		className?: cn.ClassName;
	}
}

export function Header({ className, ...props }: Header.Props) {
	return <AriaHeader {...props} className={classNames("ui-header", className)} />;
}
