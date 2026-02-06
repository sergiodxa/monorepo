import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { OverlayArrow as AriaOverlayArrow } from "react-aria-components";

export namespace OverlayArrow {
	export interface Props extends Omit<ComponentProps<typeof AriaOverlayArrow>, "className"> {
		className?: cn.ClassName;
	}
}

/**
 * OverlayArrow renders an arrow that points from an overlay to its trigger.
 *
 * @example
 * ```tsx
 * <Popover>
 *   <OverlayArrow>
 *     <svg width={12} height={12} viewBox="0 0 12 12">
 *       <path d="M0 0 L6 6 L12 0" />
 *     </svg>
 *   </OverlayArrow>
 *   {content}
 * </Popover>
 * ```
 */
export function OverlayArrow({ className, ...props }: OverlayArrow.Props) {
	return <AriaOverlayArrow {...props} className={cn("ui-overlay-arrow", className)} />;
}
