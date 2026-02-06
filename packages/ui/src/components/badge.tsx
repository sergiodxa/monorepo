import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";

export namespace Badge {
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";
	export type Variant = "default" | "secondary" | "outline";

	export interface Props extends Omit<ComponentProps<"span">, "className"> {
		className?: cn.ClassName;
		color?: Color;
		variant?: Variant;
	}

	export interface IconProps extends Omit<ComponentProps<"span">, "className"> {
		className?: cn.ClassName;
	}

	export interface TextProps extends Omit<ComponentProps<"span">, "className"> {
		className?: cn.ClassName;
	}
}

export function Badge({
	color = "neutral",
	variant = "default",
	className,
	...props
}: Badge.Props) {
	return (
		<span
			{...props}
			data-color={color}
			data-variant={variant}
			className={cn("ui-badge", className)}
		/>
	);
}

Badge.Icon = function BadgeIcon({ className, ...props }: Badge.IconProps) {
	return <span {...props} className={cn("ui-badge-icon", className)} aria-hidden />;
};

Badge.Text = function BadgeText({ className, ...props }: Badge.TextProps) {
	return <span {...props} className={cn("ui-badge-text", className)} />;
};
