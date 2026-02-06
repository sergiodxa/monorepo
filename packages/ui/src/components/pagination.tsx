import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Button as AriaButton, Link as AriaLink } from "react-aria-components";

export namespace Pagination {
	export interface Props extends Omit<ComponentProps<"nav">, "className"> {
		className?: cn.ClassName;
	}
}

export function Pagination({
	className,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	...props
}: Pagination.Props) {
	let resolvedLabel = ariaLabel ?? (ariaLabelledBy ? undefined : "Pagination");

	return (
		<nav
			{...props}
			aria-label={resolvedLabel}
			aria-labelledby={ariaLabelledBy}
			className={cn("ui-pagination", className)}
		/>
	);
}

export namespace PaginationList {
	export interface Props extends Omit<ComponentProps<"ul">, "className"> {
		className?: cn.ClassName;
	}
}

export function PaginationList({ className, ...props }: PaginationList.Props) {
	return <ul {...props} className={cn("ui-pagination-list", className)} />;
}

export namespace PaginationItem {
	export interface Props extends Omit<ComponentProps<"li">, "className"> {
		className?: cn.ClassName;
	}
}

export function PaginationItem({ className, ...props }: PaginationItem.Props) {
	return <li {...props} className={cn("ui-pagination-item", className)} />;
}

export namespace PaginationButton {
	export interface Props extends Omit<ComponentProps<typeof AriaButton>, "className"> {
		className?: cn.ClassName;
	}
}

export function PaginationButton({ className, ...props }: PaginationButton.Props) {
	return <AriaButton {...props} className={cn("ui-pagination-button", className)} />;
}

export namespace PaginationLink {
	type AriaCurrent = "page" | "step" | "location" | "date" | "time" | "true" | "false" | boolean;

	export interface Props extends Omit<ComponentProps<typeof AriaLink>, "className"> {
		className?: cn.ClassName;
		isCurrent?: boolean;
		"aria-current"?: AriaCurrent;
	}
}

export function PaginationLink({
	className,
	isCurrent,
	"aria-current": ariaCurrentProp,
	...props
}: PaginationLink.Props) {
	let ariaCurrent = ariaCurrentProp ?? (isCurrent ? "page" : undefined);

	return (
		<AriaLink
			{...props}
			aria-current={ariaCurrent}
			data-current={ariaCurrent === "page" ? "" : undefined}
			className={cn("ui-pagination-link", className)}
		/>
	);
}
