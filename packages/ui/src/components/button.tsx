import type { ComponentProps, ReactNode } from "react";

import { cn } from "@pkg/cn";
import { Button as AriaButton } from "react-aria-components";

import { type Color, ColorProvider, useColor } from "./color-context";
import { Spinner } from "./spinner";

export namespace Button {
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
	color: colorProp,
	variant = "solid",
	size = "md",
	isPending = false,
	className,
	children,
	...props
}: Button.Props) {
	let color = useColor(colorProp);

	return (
		<ColorProvider color={color}>
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
						<Spinner size={size === "lg" ? "md" : "sm"} />
						<span className="ui-button-pending-content">{children}</span>
					</>
				) : (
					children
				)}
			</AriaButton>
		</ColorProvider>
	);
}
