import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";

export namespace ScrollArea {
	export interface Props extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export type Orientation = "vertical" | "horizontal" | "both";

	export interface ViewportProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
		orientation?: Orientation;
	}
}

export function ScrollArea({ className, ...props }: ScrollArea.Props) {
	return (
		<div {...props} data-component="scroll-area" className={cn("ui-scroll-area", className)} />
	);
}

ScrollArea.Viewport = function ScrollAreaViewport({
	className,
	orientation = "vertical",
	tabIndex = 0,
	...props
}: ScrollArea.ViewportProps) {
	return (
		<div
			{...props}
			data-slot="viewport"
			data-orientation={orientation}
			tabIndex={tabIndex}
			className={cn("ui-scroll-area-viewport", className)}
		/>
	);
};
