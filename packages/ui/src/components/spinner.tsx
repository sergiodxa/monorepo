import type { ReactNode } from "react";

import { cn } from "@pkg/cn";

export namespace Spinner {
	export type Size = "sm" | "md" | "lg";
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";

	export interface Props {
		className?: cn.ClassName;
		color?: Color;
		size?: Size;
		children?: ReactNode;
		"aria-label"?: string;
		"aria-labelledby"?: string;
	}

	export interface RingProps {
		className?: cn.ClassName;
	}

	export interface LabelProps {
		className?: cn.ClassName;
		children: ReactNode;
	}
}

export function Spinner({
	className,
	color = "primary",
	size = "md",
	children,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
}: Spinner.Props) {
	return (
		<span
			role="status"
			aria-live="polite"
			aria-label={ariaLabel}
			aria-labelledby={ariaLabelledBy}
			data-color={color}
			data-size={size}
			className={cn("ui-spinner", className)}
		>
			{children}
		</span>
	);
}

function Ring({ className }: Spinner.RingProps) {
	return <span className={cn("ui-spinner-ring", className)} aria-hidden />;
}

function Label({ className, children }: Spinner.LabelProps) {
	return <span className={cn("ui-spinner-label", className)}>{children}</span>;
}

Spinner.Ring = Ring;
Spinner.Label = Label;
