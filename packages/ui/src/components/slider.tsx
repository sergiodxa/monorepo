import type { ComponentProps, CSSProperties } from "react";

import { cn } from "@pkg/cn";
import {
	Slider as AriaSlider,
	SliderTrack as AriaSliderTrack,
	SliderThumb as AriaSliderThumb,
	SliderOutput as AriaSliderOutput,
	type SliderTrackRenderProps,
} from "react-aria-components";

export namespace Slider {
	export interface Props<T extends number | number[]> extends Omit<
		ComponentProps<typeof AriaSlider<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface TrackProps extends Omit<ComponentProps<typeof AriaSliderTrack>, "className"> {
		className?: cn.ClassName;
	}

	export interface ThumbProps extends Omit<ComponentProps<typeof AriaSliderThumb>, "className"> {
		className?: cn.ClassName;
	}

	export interface OutputProps extends Omit<ComponentProps<typeof AriaSliderOutput>, "className"> {
		className?: cn.ClassName;
	}
}

export function Slider<T extends number | number[]>({ className, ...props }: Slider.Props<T>) {
	return <AriaSlider {...props} className={cn("ui-slider", className)} />;
}

Slider.Track = function SliderTrack({ className, style, ...props }: Slider.TrackProps) {
	return (
		<AriaSliderTrack
			{...props}
			className={cn("ui-slider-track", className)}
			style={(renderProps) => {
				let baseStyle = typeof style === "function" ? style(renderProps) : style;
				let fillStyle = getFillStyle(renderProps);
				return { ...baseStyle, ...fillStyle };
			}}
		/>
	);
};

function getFillStyle(renderProps: SliderTrackRenderProps): CSSProperties {
	let { state, orientation } = renderProps;

	if (state.values.length === 1) {
		// Single thumb: fill from start to thumb position
		let percent = state.getThumbPercent(0) * 100 + "%";
		if (orientation === "vertical") {
			return { "--slider-fill-height": percent } as CSSProperties;
		}
		return { "--slider-fill-width": percent } as CSSProperties;
	}

	if (state.values.length === 2) {
		// Range slider: fill between the two thumbs
		let start = state.getThumbPercent(0) * 100 + "%";
		let size = (state.getThumbPercent(1) - state.getThumbPercent(0)) * 100 + "%";
		if (orientation === "vertical") {
			return {
				"--slider-fill-start": start,
				"--slider-fill-height": size,
			} as CSSProperties;
		}
		return {
			"--slider-fill-start": start,
			"--slider-fill-width": size,
		} as CSSProperties;
	}

	return {};
}

Slider.Thumb = function SliderThumb({ className, ...props }: Slider.ThumbProps) {
	return <AriaSliderThumb {...props} className={cn("ui-slider-thumb", className)} />;
};

Slider.Output = function SliderOutput({ className, ...props }: Slider.OutputProps) {
	return <AriaSliderOutput {...props} className={cn("ui-slider-output", className)} />;
};
