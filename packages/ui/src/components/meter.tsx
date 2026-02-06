import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Meter as AriaMeter } from "react-aria-components";

import { type Color, ColorProvider, useColor } from "./color-context";

export namespace Meter {
	export interface Props extends Omit<ComponentProps<typeof AriaMeter>, "className"> {
		className?: cn.ClassName;
		color?: Color;
	}

	export interface TrackProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "className"> {
		className?: cn.ClassName;
	}

	export interface FillProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "className"> {
		className?: cn.ClassName;
		percentage: number;
	}

	export interface ValueLabelProps extends Omit<
		React.HTMLAttributes<HTMLSpanElement>,
		"className"
	> {
		className?: cn.ClassName;
	}
}

export function Meter({ className, color: colorProp, ...props }: Meter.Props) {
	let color = useColor(colorProp);
	return (
		<ColorProvider color={color}>
			<AriaMeter {...props} data-color={color} className={cn("ui-meter", className)} />
		</ColorProvider>
	);
}

Meter.Track = function MeterTrack({ className, ...props }: Meter.TrackProps) {
	return <div {...props} className={cn("ui-meter-track", className)} />;
};

Meter.Fill = function MeterFill({ className, percentage, style, ...props }: Meter.FillProps) {
	return (
		<div
			{...props}
			className={cn("ui-meter-fill", className)}
			style={
				{
					...style,
					"--meter-percentage": `${percentage}%`,
				} as React.CSSProperties
			}
		/>
	);
};

Meter.ValueLabel = function MeterValueLabel({ className, ...props }: Meter.ValueLabelProps) {
	return <span {...props} className={cn("ui-meter-value", className)} />;
};
