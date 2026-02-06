import type { cn } from "@pkg/cn";
import type { HTMLAttributes, ReactNode } from "react";

export namespace Alert {
	export type Color = "primary" | "success" | "warning" | "danger" | "neutral";
	export type Live = "polite" | "assertive" | "off";

	export interface Props extends Omit<
		HTMLAttributes<HTMLDivElement>,
		"color" | "children" | "className"
	> {
		/** The color scheme of the alert */
		color?: Color;
		/** Controls aria-live behavior for dynamic alerts. Default: "polite" */
		live?: Live;
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface IconProps extends Omit<
		HTMLAttributes<HTMLDivElement>,
		"children" | "className"
	> {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface ContentProps extends Omit<
		HTMLAttributes<HTMLDivElement>,
		"children" | "className"
	> {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface TitleProps extends Omit<
		HTMLAttributes<HTMLHeadingElement>,
		"children" | "className"
	> {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface DescriptionProps extends Omit<
		HTMLAttributes<HTMLParagraphElement>,
		"children" | "className"
	> {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface ActionProps extends Omit<
		HTMLAttributes<HTMLDivElement>,
		"children" | "className"
	> {
		children: ReactNode;
		className?: cn.ClassName;
	}
}

import { cn as classNames } from "@pkg/cn";
import { Children, isValidElement } from "react";

export function Alert({
	color = "primary",
	live = "polite",
	children,
	className,
	role = "alert",
	...props
}: Alert.Props) {
	let ariaLive = props["aria-live"] ?? (live === "off" ? undefined : live);
	let hasIcon = Children.toArray(children).some(
		(child) => isValidElement(child) && child.type === Alert.Icon,
	);

	return (
		<div
			{...props}
			role={role}
			aria-live={ariaLive}
			aria-atomic={props["aria-atomic"] ?? true}
			data-color={color}
			data-has-icon={hasIcon || undefined}
			data-slot="alert"
			className={classNames("ui-alert", className)}
		>
			{children}
		</div>
	);
}

Alert.Icon = function AlertIcon({ children, className, ...props }: Alert.IconProps) {
	let { ["aria-hidden"]: ariaHidden = true, ...rest } = props;

	return (
		<div
			{...rest}
			className={classNames("ui-alert-icon", className)}
			aria-hidden={ariaHidden}
			data-slot="icon"
		>
			{children}
		</div>
	);
};

Alert.Content = function AlertContent({ children, className, ...props }: Alert.ContentProps) {
	return (
		<div {...props} className={classNames("ui-alert-content", className)} data-slot="content">
			{children}
		</div>
	);
};

Alert.Title = function AlertTitle({ children, className, ...props }: Alert.TitleProps) {
	return (
		<h3 {...props} className={classNames("ui-alert-title", className)} data-slot="title">
			{children}
		</h3>
	);
};

Alert.Description = function AlertDescription({
	children,
	className,
	...props
}: Alert.DescriptionProps) {
	return (
		<p {...props} className={classNames("ui-alert-description", className)} data-slot="description">
			{children}
		</p>
	);
};

Alert.Action = function AlertAction({ children, className, ...props }: Alert.ActionProps) {
	return (
		<div {...props} className={classNames("ui-alert-action", className)} data-slot="action">
			{children}
		</div>
	);
};
