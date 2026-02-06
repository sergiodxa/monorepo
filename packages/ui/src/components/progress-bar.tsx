import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { ProgressBar as AriaProgressBar } from "react-aria-components";

export namespace ProgressBar {
	export interface Props extends Omit<ComponentProps<typeof AriaProgressBar>, "className"> {
		className?: cn.ClassName;
	}

	export interface TrackProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "className"> {
		className?: cn.ClassName;
	}

	export interface FillProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "className"> {
		className?: cn.ClassName;
		percentage?: number;
		isIndeterminate?: boolean;
	}

	export interface ValueLabelProps extends Omit<
		React.HTMLAttributes<HTMLSpanElement>,
		"className"
	> {
		className?: cn.ClassName;
	}
}

export function ProgressBar({ className, ...props }: ProgressBar.Props) {
	return <AriaProgressBar {...props} className={cn("ui-progress-bar", className)} />;
}

ProgressBar.Track = function ProgressBarTrack({ className, ...props }: ProgressBar.TrackProps) {
	return <div {...props} className={cn("ui-progress-bar-track", className)} />;
};

ProgressBar.Fill = function ProgressBarFill({
	className,
	percentage,
	isIndeterminate,
	style,
	...props
}: ProgressBar.FillProps) {
	return (
		<div
			{...props}
			data-indeterminate={isIndeterminate || undefined}
			className={cn("ui-progress-bar-fill", className)}
			style={
				{
					...style,
					"--progress-percentage": isIndeterminate ? "100%" : `${percentage}%`,
				} as React.CSSProperties
			}
		/>
	);
};

ProgressBar.ValueLabel = function ProgressBarValueLabel({
	className,
	...props
}: ProgressBar.ValueLabelProps) {
	return <span {...props} className={cn("ui-progress-bar-value", className)} />;
};
