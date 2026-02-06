import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@pkg/cn";

import { type Color, ColorProvider, useColor } from "./color-context";

export namespace Empty {
	export interface Props extends Omit<
		HTMLAttributes<HTMLDivElement>,
		"children" | "className" | "color"
	> {
		/** The color scheme of the empty state */
		color?: Color;
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface IconProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface TitleProps extends Omit<HTMLAttributes<HTMLHeadingElement>, "className"> {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface DescriptionProps extends Omit<
		HTMLAttributes<HTMLParagraphElement>,
		"className"
	> {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface ActionProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
		children: ReactNode;
		className?: cn.ClassName;
	}
}

export function Empty({ color: colorProp, children, className, ...props }: Empty.Props) {
	let color = useColor(colorProp);
	return (
		<ColorProvider color={color}>
			<div {...props} data-color={color} data-slot="empty" className={cn("ui-empty", className)}>
				{children}
			</div>
		</ColorProvider>
	);
}

Empty.Icon = function EmptyIcon({ children, className, ...props }: Empty.IconProps) {
	let { ["aria-hidden"]: ariaHidden = true, ...rest } = props;

	return (
		<div
			{...rest}
			className={cn("ui-empty-icon", className)}
			aria-hidden={ariaHidden}
			data-slot="icon"
		>
			{children}
		</div>
	);
};

Empty.Title = function EmptyTitle({ children, className, ...props }: Empty.TitleProps) {
	return (
		<h3 {...props} className={cn("ui-empty-title", className)} data-slot="title">
			{children}
		</h3>
	);
};

Empty.Description = function EmptyDescription({
	children,
	className,
	...props
}: Empty.DescriptionProps) {
	return (
		<p {...props} className={cn("ui-empty-description", className)} data-slot="description">
			{children}
		</p>
	);
};

Empty.Action = function EmptyAction({ children, className, ...props }: Empty.ActionProps) {
	return (
		<div {...props} className={cn("ui-empty-action", className)} data-slot="action">
			{children}
		</div>
	);
};
