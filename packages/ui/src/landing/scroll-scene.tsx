/**
 * A scroll-linked scene: a tall runway whose stage sticks under the header while the reader
 * scrolls through it, publishing a named view timeline the stage's parts animate along with
 * {@link sceneMotion}. Without scroll timelines, or under reduced motion, it is a static frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityMixin } from "@sdxc/u";
import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { animation } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { media, supports } from "@sdxc/u/responsive";

/** The feature query every scroll-linked rule here is gated on. */
const TIMELINE_SUPPORT = "(animation-timeline: view())";

/** The motion preference every scroll-linked rule here is gated on. */
const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/** The sticky header the stage sits under; the stage fills the viewport below it. */
const HEADER = "var(--ui-landing-header-height, 4rem)";

/**
 * The height of the scroller the scene plays in: the viewport by default. A scene inside a
 * fixed-height scroll panel sets `--ui-scroll-scene-viewport` to the panel's height.
 */
const VIEWPORT = "var(--ui-scroll-scene-viewport, 100svh)";

/** Viewport heights of scroll {@link ScrollScene} holds its stage for when `length` is omitted. */
const DEFAULT_LENGTH = 2.5;

/** The stretch of the scene {@link sceneMotion} spans when `range` is omitted: all of it. */
const DEFAULT_RANGE = "contain 0% contain 100%";

/**
 * Prop types for {@link ScrollScene}.
 */
export namespace ScrollScene {
	/**
	 * Props accepted by {@link ScrollScene}.
	 */
	export interface Props extends TagProps<"div"> {
		/** The view timeline's name without its leading dashes; {@link sceneMotion} takes the same. */
		timeline: string;
		/**
		 * Viewport heights of scroll the stage stays pinned for. A longer runway plays the
		 * scene more slowly against the reader's scroll.
		 *
		 * @default 2.5
		 */
		length?: number;
		/** The stage: the drawing and whatever annotates it, sized to fit under the header. */
		children: RemixNode;
	}

	/** The stops a part of the stage runs through, as `@keyframes` selectors to declarations. */
	export type Keyframes = Record<string, Record<string, string | number>>;
}

/**
 * Renders the runway and a sticky stage centred under `--ui-landing-header-height`, all in CSS
 * with nothing to hydrate; inside a scroll panel, set `--ui-scroll-scene-viewport` to its height.
 * Without view timelines, or under reduced motion, the stage sits in normal flow as a still frame.
 *
 * @param handle Runtime handle carrying the timeline name, length and stage.
 * @returns The render function producing the scene.
 * @example
 * <ScrollScene timeline="explode" length={2.6}>
 * 	<div mix={[sceneMotion("explode", { from: { translate: "0 0 0" } }, "contain 5% contain 70%")]} />
 * </ScrollScene>
 */
export function ScrollScene(handle: Handle<ScrollScene.Props>) {
	return () => {
		let { timeline, length = DEFAULT_LENGTH, children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="scroll-scene"
				mix={[
					raw({ position: "relative", viewTimelineName: `--${timeline}` }),
					supports(
						TIMELINE_SUPPORT,
						media(MOTION_OK, raw({ blockSize: `calc(${length} * (${VIEWPORT} - ${HEADER}))` })),
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
									blockSize: `calc(${VIEWPORT} - ${HEADER})`,
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
 * Runs a part of a {@link ScrollScene} through keyframes as the reader scrolls the scene.
 * The part's own styles are the static frame a reader who prefers reduced motion, or a
 * browser without scroll timelines, sees, so the last keyframe should match them.
 *
 * @param timeline The scene's timeline name, as given to {@link ScrollScene}.
 * @param keyframes The stops the part runs through.
 * @param range The stretch of the scene the stops span, as an `animation-range`.
 * @param easing How the part moves between stops; `steps(n)` ticks, as typed text does.
 * @returns One mixin for the part's `mix`.
 * @example mix={[sceneMotion("explode", { from: { opacity: "0.3" }, to: { opacity: "1" } }, "contain 10% contain 30%")]}
 */
export function sceneMotion(
	timeline: string,
	keyframes: ScrollScene.Keyframes,
	range: string = DEFAULT_RANGE,
	easing = "linear",
): UtilityMixin {
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
