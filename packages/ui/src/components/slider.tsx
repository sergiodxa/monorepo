import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import {
	Slider as AriaSlider,
	SliderTrack as AriaSliderTrack,
	SliderThumb as AriaSliderThumb,
	SliderOutput as AriaSliderOutput,
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
	return <AriaSlider {...props} className={classNames("ui-slider", className)} />;
}

Slider.Track = function SliderTrack({ className, ...props }: Slider.TrackProps) {
	return <AriaSliderTrack {...props} className={classNames("ui-slider-track", className)} />;
};

Slider.Thumb = function SliderThumb({ className, ...props }: Slider.ThumbProps) {
	return <AriaSliderThumb {...props} className={classNames("ui-slider-thumb", className)} />;
};

Slider.Output = function SliderOutput({ className, ...props }: Slider.OutputProps) {
	return <AriaSliderOutput {...props} className={classNames("ui-slider-output", className)} />;
};
