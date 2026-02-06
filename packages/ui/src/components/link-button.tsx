import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Link as AriaLink } from "react-aria-components";

import { type Color, ColorProvider, useColor } from "./color-context";

export namespace LinkButton {
	export type Variant = "solid" | "outline" | "ghost";
	export type Size = "sm" | "md" | "lg";

	export interface Props extends Omit<ComponentProps<typeof AriaLink>, "className"> {
		className?: cn.ClassName;
		color?: Color;
		variant?: Variant;
		size?: Size;
	}
}

export function LinkButton({
	color: colorProp,
	variant = "solid",
	size = "md",
	className,
	...props
}: LinkButton.Props) {
	let color = useColor(colorProp);
	return (
		<ColorProvider color={color}>
			<AriaLink
				{...props}
				className={cn("ui-button", className)}
				data-color={color}
				data-variant={variant}
				data-size={size}
			/>
		</ColorProvider>
	);
}
