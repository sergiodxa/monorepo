/**
 * A scroll-linked scene: a tall runway whose stage sticks under the header while the reader
 * scrolls through it, publishing a named view timeline its drawings animate along. Without
 * scroll timelines, or under reduced motion, the stage is a static frame in normal flow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { animation } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { media, supports } from "@sdxc/u/responsive";

/** The feature query every scroll-linked rule here is gated on. */
const TIMELINE_SUPPORT = "(animation-timeline: view())";

/** The motion preference every scroll-linked rule here is gated on. */
const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/** The header the stage sticks under; the stage fills the viewport below it. */
const HEADER = "var(--ui-landing-header-height, 4rem)";

export namespace ScrollScene {
	export interface Props extends TagProps<"div"> {
		/** The view timeline's name without its dashes; {@link sceneMotion} takes the same. */
		timeline: string;
		/**
		 * How many viewport heights of scroll the scene holds its stage for. Longer runways
		 * slow the animation down against the reader's scroll.
		 * @default 2.5
		 */
		length?: number;
		/** The stage: the drawing and whatever annotates it. */
		children: RemixNode;
	}

	/** Keyframes a part of the stage runs through, as `@keyframes` stops. */
	export type Keyframes = Record<string, Record<string, string | number>>;
}

/**
 * Renders the runway and its sticky stage. The stage is a grid centred in the space under
 * the header, so a drawing sized to fit it stays wholly in view for the scene's length.
 *
 * @param handle Runtime handle carrying the timeline name, length and stage.
 * @returns The render function producing the scene.
 */
export function ScrollScene(handle: Handle<ScrollScene.Props>) {
	return () => {
		let { timeline, length = 2.5, children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="scroll-scene"
				mix={[
					raw({ position: "relative", viewTimelineName: `--${timeline}` }),
					supports(
						TIMELINE_SUPPORT,
						media(MOTION_OK, raw({ blockSize: `calc(${length} * (100svh - ${HEADER}))` })),
					),
					mix,
				]}
			>
				<div
					data-slot="scroll-scene-stage"
					mix={[
						raw({ display: "grid", alignContent: "center" }),
						supports(
							TIMELINE_SUPPORT,
							media(
								MOTION_OK,
								raw({
									position: "sticky",
									insetBlockStart: HEADER,
									blockSize: `calc(100svh - ${HEADER})`,
								}),
							),
						),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

/**
 * Runs a part of a scene through keyframes as the reader scrolls the scene. The part's own
 * styles are the static frame, so the last keyframe should match them: that is what a
 * reader who prefers reduced motion, or a browser without scroll timelines, sees.
 *
 * @param timeline The scene's timeline name, as given to {@link ScrollScene}.
 * @param keyframes The stops the part runs through.
 * @param range The stretch of the scene the stops span, as an `animation-range`.
 * @param easing How the part moves between stops; `steps(n)` ticks, as typing does.
 * @returns One mixin for the part's `mix`.
 * @example mix={[sceneMotion("explode", { from: { translate: "0 0 0" } }, "contain 0% contain 60%")]}
 */
export function sceneMotion(
	timeline: string,
	keyframes: ScrollScene.Keyframes,
	range = "contain 0% contain 100%",
	easing = "linear",
) {
	return supports(
		TIMELINE_SUPPORT,
		media(
			MOTION_OK,
			animation({
				keyframes,
				duration: "auto",
				easing,
				fillMode: "both",
				timeline: `--${timeline}`,
				range,
			}),
		),
	);
}
