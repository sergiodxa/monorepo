import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { DropZone as AriaDropZone } from "react-aria-components";

export namespace DropZone {
	export interface Props extends Omit<ComponentProps<typeof AriaDropZone>, "className"> {
		className?: cn.ClassName;
	}
}

export function DropZone({ className, ...props }: DropZone.Props) {
	return <AriaDropZone {...props} className={classNames("ui-drop-zone", className)} />;
}
