import type { HTMLAttributes } from "react";

import { cn } from "@pkg/cn";

export namespace Skeleton {
	export interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
		className?: cn.ClassName;
	}
}

export function Skeleton({ className, ...props }: Skeleton.Props) {
	let { ["aria-hidden"]: ariaHidden = true, ...rest } = props;

	return <div {...rest} aria-hidden={ariaHidden} className={cn("ui-skeleton", className)} />;
}
