import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";

export namespace Card {
	export interface Props extends Omit<ComponentProps<"section">, "className"> {
		className?: cn.ClassName;
	}

	export interface HeaderProps extends Omit<ComponentProps<"header">, "className"> {
		className?: cn.ClassName;
	}

	export interface TitleProps extends Omit<ComponentProps<"h3">, "className"> {
		className?: cn.ClassName;
	}

	export interface DescriptionProps extends Omit<ComponentProps<"p">, "className"> {
		className?: cn.ClassName;
	}

	export interface ContentProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface FooterProps extends Omit<ComponentProps<"footer">, "className"> {
		className?: cn.ClassName;
	}
}

export function Card({ className, ...props }: Card.Props) {
	return <section {...props} data-component="card" className={classNames("ui-card", className)} />;
}

Card.Header = function CardHeader({ className, ...props }: Card.HeaderProps) {
	return (
		<header {...props} data-slot="header" className={classNames("ui-card-header", className)} />
	);
};

Card.Title = function CardTitle({ className, ...props }: Card.TitleProps) {
	return <h3 {...props} data-slot="title" className={classNames("ui-card-title", className)} />;
};

Card.Description = function CardDescription({ className, ...props }: Card.DescriptionProps) {
	return (
		<p
			{...props}
			data-slot="description"
			className={classNames("ui-card-description", className)}
		/>
	);
};

Card.Content = function CardContent({ className, ...props }: Card.ContentProps) {
	return (
		<div {...props} data-slot="content" className={classNames("ui-card-content", className)} />
	);
};

Card.Footer = function CardFooter({ className, ...props }: Card.FooterProps) {
	return (
		<footer {...props} data-slot="footer" className={classNames("ui-card-footer", className)} />
	);
};
