import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Link as AriaLink } from "react-aria-components";

export namespace LinkButton {
	export type Color = "primary" | "neutral" | "danger" | "warning" | "success";
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
	color = "primary",
	variant = "solid",
	size = "md",
	className,
	...props
}: LinkButton.Props) {
	return (
		<AriaLink
			{...props}
			className={cn("ui-button", className)}
			data-color={color}
			data-variant={variant}
			data-size={size}
		/>
	);
}
