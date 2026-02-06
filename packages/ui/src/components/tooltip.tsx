import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import {
	Tooltip as AriaTooltip,
	TooltipTrigger as AriaTooltipTrigger,
	OverlayArrow,
} from "react-aria-components";

export namespace TooltipTrigger {
	export interface Props extends ComponentProps<typeof AriaTooltipTrigger> {}
}

export function TooltipTrigger(props: TooltipTrigger.Props) {
	return <AriaTooltipTrigger {...props} />;
}

export namespace Tooltip {
	export interface Props extends Omit<ComponentProps<typeof AriaTooltip>, "className"> {
		className?: cn.ClassName;
		/** Whether to show the arrow */
		showArrow?: boolean;
	}
}

export function Tooltip({
	className,
	children,
	showArrow = true,
	offset = 8,
	...props
}: Tooltip.Props) {
	return (
		<AriaTooltip {...props} offset={offset} className={cn("ui-tooltip", className)}>
			{(renderProps) => (
				<>
					{showArrow && (
						<OverlayArrow className="ui-tooltip-arrow">
							<svg width={8} height={8} viewBox="0 0 8 8">
								<path d="M0 0 L4 4 L8 0" />
							</svg>
						</OverlayArrow>
					)}
					{typeof children === "function" ? children(renderProps) : children}
				</>
			)}
		</AriaTooltip>
	);
}
