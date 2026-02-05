import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Toolbar as AriaToolbar } from "react-aria-components";

export namespace Toolbar {
	export interface Props extends Omit<ComponentProps<typeof AriaToolbar>, "className"> {
		className?: cn.ClassName;
	}
}

export function Toolbar({ className, ...props }: Toolbar.Props) {
	return <AriaToolbar {...props} className={classNames("ui-toolbar", className)} />;
}
