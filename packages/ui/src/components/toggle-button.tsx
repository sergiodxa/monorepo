import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import {
	ToggleButton as AriaToggleButton,
	ToggleButtonGroup as AriaToggleButtonGroup,
} from "react-aria-components";

export namespace ToggleButton {
	export type Color = "primary" | "neutral" | "danger" | "warning";
	export type Variant = "solid" | "outline" | "ghost";
	export type Size = "sm" | "md" | "lg";

	export interface Props extends Omit<ComponentProps<typeof AriaToggleButton>, "className"> {
		className?: cn.ClassName;
		color?: Color;
		variant?: Variant;
		size?: Size;
	}
}

export function ToggleButton({
	className,
	color = "neutral",
	variant = "outline",
	size = "md",
	...props
}: ToggleButton.Props) {
	return (
		<AriaToggleButton
			{...props}
			data-color={color}
			data-variant={variant}
			data-size={size}
			className={classNames("ui-toggle-button", className)}
		/>
	);
}

export namespace ToggleButtonGroup {
	export interface Props extends Omit<ComponentProps<typeof AriaToggleButtonGroup>, "className"> {
		className?: cn.ClassName;
	}
}

export function ToggleButtonGroup({ className, ...props }: ToggleButtonGroup.Props) {
	return (
		<AriaToggleButtonGroup {...props} className={classNames("ui-toggle-button-group", className)} />
	);
}
