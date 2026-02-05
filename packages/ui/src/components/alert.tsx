import type { cn } from "@pkg/cn";
import type { ReactNode } from "react";

export namespace Alert {
	export type Variant = "info" | "warning" | "danger" | "success";
	export type Live = "polite" | "assertive" | "off";

	export interface Props {
		variant?: Variant;
		/** Controls aria-live behavior for dynamic alerts. Default: "polite" */
		live?: Live;
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface IconProps {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface ContentProps {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface TitleProps {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface DescriptionProps {
		children: ReactNode;
		className?: cn.ClassName;
	}

	export interface ActionProps {
		children: ReactNode;
		className?: cn.ClassName;
	}
}

import { cn as classNames } from "@pkg/cn";

export function Alert({ variant = "info", live = "polite", children, className }: Alert.Props) {
	return (
		<div
			role="alert"
			aria-live={live === "off" ? undefined : live}
			data-variant={variant}
			className={classNames("ui-alert", className)}
		>
			{children}
		</div>
	);
}

Alert.Icon = function AlertIcon({ children, className }: Alert.IconProps) {
	return (
		<div className={classNames("ui-alert-icon", className)} aria-hidden>
			{children}
		</div>
	);
};

Alert.Content = function AlertContent({ children, className }: Alert.ContentProps) {
	return <div className={classNames("ui-alert-content", className)}>{children}</div>;
};

Alert.Title = function AlertTitle({ children, className }: Alert.TitleProps) {
	return <h3 className={classNames("ui-alert-title", className)}>{children}</h3>;
};

Alert.Description = function AlertDescription({ children, className }: Alert.DescriptionProps) {
	return <p className={classNames("ui-alert-description", className)}>{children}</p>;
};

Alert.Action = function AlertAction({ children, className }: Alert.ActionProps) {
	return <div className={classNames("ui-alert-action", className)}>{children}</div>;
};
