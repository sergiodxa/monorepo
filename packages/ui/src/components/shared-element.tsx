import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { SharedElement as AriaSharedElement } from "react-aria-components";

export namespace SharedElement {
	export interface Props extends Omit<ComponentProps<typeof AriaSharedElement>, "className"> {
		className?: cn.ClassName;
	}
}

/**
 * SharedElement enables view transitions between elements with matching IDs.
 *
 * @example
 * ```tsx
 * // On page 1
 * <SharedElement id="hero-image">
 *   <img src="/hero.jpg" />
 * </SharedElement>
 *
 * // On page 2
 * <SharedElement id="hero-image">
 *   <img src="/hero.jpg" />
 * </SharedElement>
 * ```
 */
export function SharedElement({ className, ...props }: SharedElement.Props) {
	return <AriaSharedElement {...props} className={cn("ui-shared-element", className)} />;
}
