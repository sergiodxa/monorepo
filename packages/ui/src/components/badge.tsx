import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";

export namespace Badge {
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";
	export type Variant = "default" | "secondary" | "destructive" | "outline";

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

export function Badge({ color, variant = "default", className, ...props }: Badge.Props) {
	let resolvedColor = color ?? (variant === "destructive" ? "danger" : "primary");

	return (
		<span
			{...props}
			data-color={resolvedColor}
			data-variant={variant}
			className={classNames("ui-badge", className)}
		/>
	);
}

Badge.Icon = function BadgeIcon({ className, ...props }: Badge.IconProps) {
	return <span {...props} className={classNames("ui-badge-icon", className)} aria-hidden />;
};

Badge.Text = function BadgeText({ className, ...props }: Badge.TextProps) {
	return <span {...props} className={classNames("ui-badge-text", className)} />;
};
