import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";

import { type Color, ColorProvider, useColor } from "./color-context";

export namespace Card {
	export interface Props extends Omit<ComponentProps<"section">, "className"> {
		className?: cn.ClassName;
		color?: Color;
	}

	export interface HeaderProps extends Omit<ComponentProps<"header">, "className"> {
		className?: cn.ClassName;
		color?: Color;
	}

	export interface TitleProps extends Omit<ComponentProps<"h3">, "className"> {
		className?: cn.ClassName;
		color?: Color;
	}

	export interface DescriptionProps extends Omit<ComponentProps<"p">, "className"> {
		className?: cn.ClassName;
		color?: Color;
	}

	export interface ContentProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
		color?: Color;
	}

	export interface FooterProps extends Omit<ComponentProps<"footer">, "className"> {
		className?: cn.ClassName;
		color?: Color;
	}
}

export function Card({ className, color: colorProp, ...props }: Card.Props) {
	let color = useColor(colorProp);
	return (
		<ColorProvider color={color}>
			<section
				{...props}
				data-component="card"
				data-color={color}
				className={cn("ui-card", className)}
			/>
		</ColorProvider>
	);
}

Card.Header = function CardHeader({ className, color: colorProp, ...props }: Card.HeaderProps) {
	let color = useColor(colorProp);
	return (
		<ColorProvider color={color}>
			<header
				{...props}
				data-slot="header"
				data-color={color}
				className={cn("ui-card-header", className)}
			/>
		</ColorProvider>
	);
};

Card.Title = function CardTitle({
	className,
	color: colorProp,
	children,
	...props
}: Card.TitleProps) {
	let color = useColor(colorProp);
	return (
		<ColorProvider color={color}>
			<h3
				{...props}
				data-slot="title"
				data-color={color}
				className={cn("ui-card-title", className)}
			>
				{children}
			</h3>
		</ColorProvider>
	);
};

Card.Description = function CardDescription({
	className,
	color: colorProp,
	...props
}: Card.DescriptionProps) {
	let color = useColor(colorProp);
	return (
		<ColorProvider color={color}>
			<p
				{...props}
				data-slot="description"
				data-color={color}
				className={cn("ui-card-description", className)}
			/>
		</ColorProvider>
	);
};

Card.Content = function CardContent({ className, color: colorProp, ...props }: Card.ContentProps) {
	let color = useColor(colorProp);
	return (
		<ColorProvider color={color}>
			<div
				{...props}
				data-slot="content"
				data-color={color}
				className={cn("ui-card-content", className)}
			/>
		</ColorProvider>
	);
};

Card.Footer = function CardFooter({ className, color: colorProp, ...props }: Card.FooterProps) {
	let color = useColor(colorProp);
	return (
		<ColorProvider color={color}>
			<footer
				{...props}
				data-slot="footer"
				data-color={color}
				className={cn("ui-card-footer", className)}
			/>
		</ColorProvider>
	);
};
