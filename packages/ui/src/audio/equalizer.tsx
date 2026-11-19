/**
 * The "this is playing" mark a music app puts on a track: four bars that bounce while the
 * music plays and settle when it pauses. The player marks the pause on any ancestor with
 * `data-audio-paused`, so every mark on the page follows one attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { keyframes } from "@sdxc/u/animation";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";

/** The keyframes every bar shares, each at its own pace and delay. */
const BOUNCE = "ui-equalizer-bounce";

/** Each bar's height at rest and its bounce's length and delay, so the four never move as one. */
const BARS = [
	{ rest: "45%", duration: "0.9s", delay: "-0.2s" },
	{ rest: "80%", duration: "0.7s", delay: "-0.5s" },
	{ rest: "60%", duration: "1.1s", delay: "-0.1s" },
	{ rest: "35%", duration: "0.8s", delay: "-0.6s" },
] as const;

/** Prop types for {@link Equalizer}. */
export namespace Equalizer {
	/** Every native `<span>` attribute, plus the mark's spoken name. */
	export interface Props extends Omit<TagProps<"span">, "children"> {
		/** What a screen reader hears in place of the bars, such as "Now playing". */
		label?: string;
	}
}

/**
 * Renders the bars in the current text color at 1em square. They hold still under reduced
 * motion and inside any `[data-audio-paused]` ancestor.
 *
 * @example <Equalizer label="Now playing" />
 */
export function Equalizer(handle: Handle<Equalizer.Props>) {
	return () => {
		let { label, mix, ...rest } = handle.props;
		return (
			<span
				{...rest}
				data-slot="equalizer"
				mix={mergeMix(
					[
						keyframes(BOUNCE, {
							"0%, 100%": { transform: "scaleY(0.3)" },
							"50%": { transform: "scaleY(1)" },
						}),
						raw({
							display: "inline-flex",
							alignItems: "flex-end",
							justifyContent: "center",
							gap: "0.125em",
							inlineSize: "1em",
							blockSize: "1em",
							color: "inherit",
							"& > [data-bar]": {
								inlineSize: "0.1875em",
								borderRadius: "0.0625em",
								backgroundColor: "currentColor",
								transformOrigin: "bottom",
								animationName: BOUNCE,
								animationTimingFunction: "ease-in-out",
								animationIterationCount: "infinite",
							},
							":where([data-audio-paused]) & > [data-bar]": {
								animationPlayState: "paused",
							},
						}),
						motionReduce(raw({ "& > [data-bar]": { animationName: "none" } })),
					],
					mix,
				)}
			>
				{BARS.map((bar) => (
					<span
						data-bar=""
						aria-hidden="true"
						style={{
							blockSize: bar.rest,
							animationDuration: bar.duration,
							animationDelay: bar.delay,
						}}
					/>
				))}
				{label === undefined ? null : <span mix={[visuallyHidden()]}>{label}</span>}
			</span>
		);
	};
}
