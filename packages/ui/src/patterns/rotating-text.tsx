/**
 * A word in a headline that cycles through alternatives: each rises in, holds, and leaves
 * upward, in a box as wide as the widest word so the sentence never reflows. It plays a
 * set number of passes and settles on the first word, which is also the reduced-motion text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { keyframes } from "@sdxc/u/animation";
import { combine, raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

/** Seconds each word holds the slot when `interval` is omitted. */
const DEFAULT_INTERVAL = 2.5;

/** Passes through the words when `iterations` is omitted; two stay under WCAG's pause threshold for short lists. */
const DEFAULT_ITERATIONS = 2;

/** Keyframes prefix; each word count gets its own set, since the hold share depends on it. */
const KEYFRAMES_PREFIX = "ui-rotating-text";

/**
 * Prop types for {@link RotatingText}.
 */
export namespace RotatingText {
	/**
	 * Props accepted by {@link RotatingText}.
	 */
	export interface Props extends TagProps<"span"> {
		/** The alternatives, first one first; two to six read well. */
		words: RemixNode[];
		/** Seconds each word holds. Defaults to {@link DEFAULT_INTERVAL}. */
		interval?: number;
		/**
		 * Passes before settling on the first word, or `"infinite"`; wrap an endless one
		 * in a {@link MotionLoop} so it can be paused. Defaults to {@link DEFAULT_ITERATIONS}.
		 */
		iterations?: number | "infinite";
		/**
		 * What assistive technology reads in the word's place. Defaults to the words
		 * joined with commas, so a listener hears every alternative.
		 */
		label?: string;
	}
}

/**
 * Stacks every word in one grid cell and runs one shared keyframe set on each, offset by
 * its position, so exactly one word shows at a time. The animated words are hidden from
 * assistive technology, which reads `label` instead.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the word's markup.
 * @example
 * <h1>Status pages for <RotatingText words={["startups", "agencies", "platforms"]} /></h1>
 */
export function RotatingText(handle: Handle<RotatingText.Props>) {
	return () => {
		let { interval, iterations, label, mix, words, ...rest } = handle.props;
		let count = Math.max(words.length, 1);
		let hold = interval ?? DEFAULT_INTERVAL;
		let passes = iterations ?? DEFAULT_ITERATIONS;
		let spoken = label ?? words.filter((word) => typeof word === "string").join(", ");

		return (
			<span {...rest} data-slot="rotating-text" mix={[host(), mix]}>
				{spoken ? <span mix={[visuallyHidden()]}>{spoken}</span> : null}
				<span aria-hidden={spoken ? "true" : undefined} mix={[stack(count, hold, passes)]}>
					{words.map((word, index) => (
						<span key={index} data-slot="rotating-text-word" style={`--i: ${index}`}>
							{word}
						</span>
					))}
				</span>
			</span>
		);
	};
}

/** Keeps the word on the line's baseline and lets it inherit the headline's color. */
function host() {
	return raw({ display: "inline-block", whiteSpace: "nowrap", verticalAlign: "bottom" });
}

/**
 * The word stack: one grid cell, so its width is the widest word. At rest only the first
 * word shows; with motion allowed each word runs the cycle `--i` intervals after the first,
 * and the first returns to its resting state once the passes end.
 */
function stack(count: number, hold: number, passes: number | "infinite") {
	let name = `${KEYFRAMES_PREFIX}-${count}`;
	let share = 100 / count;
	let fade = Math.min(share * 0.25, 8);

	return combine([
		keyframes(name, {
			"0%": { opacity: "0", translate: "0 0.35em" },
			[`${fade}%`]: { opacity: "1", translate: "0 0" },
			[`${share - fade}%`]: { opacity: "1", translate: "0 0" },
			[`${share}%`]: { opacity: "0", translate: "0 -0.35em" },
			"100%": { opacity: "0", translate: "0 -0.35em" },
		}),
		raw({ display: "inline-grid", overflow: "clip", overflowClipMargin: "0.2em" }),
		when("& > *", raw({ gridArea: "1 / 1", opacity: "0" })),
		when("& > :first-child", raw({ opacity: "1" })),
		count > 1
			? motionSafe(
					when(
						"& > *",
						raw({
							animationName: name,
							animationDuration: `${hold * count}s`,
							animationTimingFunction: "cubic-bezier(.2,.7,.2,1)",
							animationDelay: `calc(var(--i) * ${hold}s)`,
							animationIterationCount: String(passes),
						}),
					),
				)
			: [],
	]);
}
