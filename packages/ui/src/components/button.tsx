import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Button as AriaButton } from "react-aria-components";

export namespace Button {
	export type Color = "primary" | "neutral" | "danger" | "warning" | "success";
	export type Variant = "solid" | "outline" | "ghost";
	export type Size = "sm" | "md" | "lg";

	export interface Props extends Omit<ComponentProps<typeof AriaButton>, "className"> {
		className?: cn.ClassName;
		color?: Color;
		variant?: Variant;
		size?: Size;
	}
}

export function Button({
	color = "primary",
	variant = "solid",
	size = "md",
	className,
	...props
}: Button.Props) {
	return (
		<AriaButton
			{...props}
			className={classNames("ui-button", className)}
			data-color={color}
			data-variant={variant}
			data-size={size}
		/>
	);
}
