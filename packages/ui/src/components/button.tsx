import type { ComponentProps, ReactNode } from "react";

import { cn } from "@pkg/cn";
import { Button as AriaButton } from "react-aria-components";

import { Spinner } from "./spinner";

export namespace Button {
	export type Color = "primary" | "neutral" | "danger" | "warning" | "success";
	export type Variant = "solid" | "outline" | "ghost";
	export type Size = "sm" | "md" | "lg";

	export interface Props extends Omit<ComponentProps<typeof AriaButton>, "className"> {
		className?: cn.ClassName;
		color?: Color;
		variant?: Variant;
		size?: Size;
		/** Shows a loading spinner and disables the button */
		isPending?: boolean;
		children?: ReactNode;
	}
}

export function Button({
	color = "primary",
	variant = "solid",
	size = "md",
	isPending = false,
	className,
	children,
	...props
}: Button.Props) {
	return (
		<AriaButton
			{...props}
			isDisabled={props.isDisabled || isPending}
			className={cn("ui-button", className)}
			data-color={color}
			data-variant={variant}
			data-size={size}
			data-pending={isPending || undefined}
		>
			{isPending ? (
				<>
					<span role="status" aria-label="Loading" data-size={size} className="ui-button-spinner">
						<Spinner.Ring />
					</span>
					<span className="ui-button-pending-content">{children}</span>
				</>
			) : (
				children
			)}
		</AriaButton>
	);
}
