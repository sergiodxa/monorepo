import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Meter as AriaMeter } from "react-aria-components";

export namespace Meter {
	export type Color = "primary" | "success" | "warning" | "danger";

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

export function Meter({ className, color = "primary", ...props }: Meter.Props) {
	return <AriaMeter {...props} data-color={color} className={classNames("ui-meter", className)} />;
}

Meter.Track = function MeterTrack({ className, ...props }: Meter.TrackProps) {
	return <div {...props} className={classNames("ui-meter-track", className)} />;
};

Meter.Fill = function MeterFill({ className, percentage, style, ...props }: Meter.FillProps) {
	return (
		<div
			{...props}
			className={classNames("ui-meter-fill", className)}
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
	return <span {...props} className={classNames("ui-meter-value", className)} />;
};
