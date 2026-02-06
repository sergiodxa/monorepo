import type { CSSProperties, ComponentProps } from "react";

import { cn } from "@pkg/cn";

export namespace AspectRatio {
	export type Ratio = number | string;

	export interface Props extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
		ratio?: Ratio;
	}
}

type AspectRatioStyle = CSSProperties & {
	"--ui-aspect-ratio"?: string | number;
};

export function AspectRatio({ ratio = "1 / 1", className, style, ...props }: AspectRatio.Props) {
	let resolvedRatio = typeof ratio === "number" ? String(ratio) : ratio;

	return (
		<div
			{...props}
			className={cn("ui-aspect-ratio", className)}
			style={{ ...style, "--ui-aspect-ratio": resolvedRatio } as AspectRatioStyle}
		/>
	);
}
