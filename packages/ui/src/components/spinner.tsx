import { cn } from "@pkg/cn";
import { LoaderCircleIcon } from "lucide-react";
import { ProgressBar } from "react-aria-components";

import { type Color, ColorProvider, useColor } from "./color-context";

export namespace Spinner {
	export type Size = "sm" | "md" | "lg";

	export interface Props {
		className?: cn.ClassName;
		color?: Color;
		size?: Size;
		"aria-label"?: string;
	}
}

export function Spinner({
	className,
	color: colorProp,
	size = "md",
	"aria-label": ariaLabel = "Loading",
}: Spinner.Props) {
	let color = useColor(colorProp);

	return (
		<ColorProvider color={color}>
			<ProgressBar
				isIndeterminate
				aria-label={ariaLabel}
				className={cn("ui-spinner", className)}
				data-color={color}
				data-size={size}
			>
				<LoaderCircleIcon className="ui-spinner-icon" aria-hidden />
			</ProgressBar>
		</ColorProvider>
	);
}
