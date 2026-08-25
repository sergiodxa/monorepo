/**
 * Scroll-driven animation factories riding `animation-timeline: scroll()` and
 * `view()`: a sticky header's shadow, a scroll-position progress indicator,
 * an element's entry motion as it scrolls into the viewport, and a scroll
 * container's own edge fade hinting at content beyond its current view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor } from "remix/ui";

import { animation, keyframes } from "@pkg/u/animation";
import { mask } from "@pkg/u/effects";
import { combine, raw } from "@pkg/u/general";
import { media, supports } from "@pkg/u/responsive";
import { is } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { translateProperty } from "@pkg/u/transform";

import type { CSSStyles } from "../utils/css-styles";

import { easings } from "./tokens";

const DEFAULT_SCROLL_SHADOW_DISTANCE = "120px";
const SCROLL_SHADOW_KEYFRAMES_NAME = "ui-scroll-shadow-reveal";

const DEFAULT_SCROLL_PROGRESS_AXIS = "block";
const SCROLL_PROGRESS_FILL_KEYFRAMES_NAME = "ui-scroll-progress-fill";
const SCROLL_PROGRESS_FADE_KEYFRAMES_NAME = "ui-scroll-progress-fade";

const DEFAULT_VIEW_REVEAL_FROM: ViewReveal.Direction = "block-end";
const DEFAULT_VIEW_REVEAL_DISTANCE = "1.5rem";
const DEFAULT_VIEW_REVEAL_AXIS = "block";
const DEFAULT_VIEW_REVEAL_RANGE = "entry";
const VIEW_REVEAL_TRANSLATE_PROPERTY = "--ui-view-reveal-translate";
const VIEW_REVEAL_KEYFRAMES_NAME = "ui-view-reveal-enter";
const VIEW_REVEAL_REDUCED_KEYFRAMES_NAME = "ui-view-reveal-reduced";

const DEFAULT_SCROLL_FADE_AXIS: NonNullable<ScrollFade.Options["axis"]> = "block";
const DEFAULT_SCROLL_FADE_SIZE = "3rem";
const SCROLL_FADE_DIRECTION_PROPERTY = "--ui-scroll-fade-direction";
const SCROLL_FADE_KEYFRAMES_NAME = "ui-scroll-fade-mask";
/**
 * Proportion of the tracked scroll range each edge's fade takes to ramp
 * fully in or out. Held as a proportion because the scroll-linked keyframes
 * below sit at percentages of whatever range the container's content scrolls.
 */
const SCROLL_FADE_RAMP_PERCENT = 8;
/** Gradient direction each axis paints its mask along; `"inline"` reads its actual value from {@link SCROLL_FADE_DIRECTION_PROPERTY}, mirrored under `:dir(rtl)`. */
const SCROLL_FADE_AXIS_DIRECTION: Record<NonNullable<ScrollFade.Options["axis"]>, string> = {
	block: "to bottom",
	inline: `to var(${SCROLL_FADE_DIRECTION_PROPERTY}, right)`,
};

/**
 * Options accepted by {@link scrollShadow}.
 */
export namespace ScrollShadow {
	/**
	 * Options controlling how far a sticky element's own scroll container
	 * must scroll before its shadow fully settles in.
	 */
	export interface Options {
		/**
		 * CSS length the shadow ramps in over, measured from the top of the
		 * tracked scroll container. Defaults to `"120px"`.
		 */
		distance?: string;
	}
}

/**
 * Gives a sticky header a scroll-driven shadow, so it reads as elevated only
 * once content has scrolled beneath it. Reduced motion pins the shadow on;
 * engines without scroll timelines leave the header flat.
 *
 * @param options Tuning for how quickly the shadow settles in.
 * @returns A style mixin, applicable through a host element's `mix` prop.
 * @example
 * mix={scrollShadow({ distance: "80px" })}
 */
export function scrollShadow(options: ScrollShadow.Options = {}): CSSMixinDescriptor {
	let distance = options.distance ?? DEFAULT_SCROLL_SHADOW_DISTANCE;

	return supports("(animation-timeline: scroll())", [
		animation(SCROLL_SHADOW_KEYFRAMES_NAME, {
			keyframes: {
				from: { boxShadow: "0 0 0 0 transparent" },
				to: { boxShadow: "var(--ui-scroll-shadow, 0 4px 12px -4px rgb(0 0 0 / 0.18))" },
			},
			duration: "auto",
			easing: easings.linear,
			fillMode: "both",
			timeline: "scroll(nearest block)",
			range: `0 ${distance}`,
		}),
		media(
			"(prefers-reduced-motion: reduce)",
			raw({
				animationName: "none",
				boxShadow: "var(--ui-scroll-shadow, 0 4px 12px -4px rgb(0 0 0 / 0.18))",
			}),
		),
	]);
}

/**
 * Options accepted by {@link scrollProgress}.
 */
export namespace ScrollProgress {
	/**
	 * Options selecting which scroll axis a progress indicator tracks.
	 */
	export interface Options {
		/**
		 * Scroll axis the indicator's timeline attaches to: `"block"` tracks
		 * vertical scroll (a reading-progress bar), `"inline"` horizontal scroll
		 * (a Carousel viewport). Defaults to `"block"`.
		 */
		axis?: "block" | "inline";
	}
}

/**
 * Grows a fill element in lockstep with its scrollable ancestor's scroll
 * position, from the inline-start edge so it reads correctly in both writing
 * directions. Nest it in a fixed-size track; reduced motion ramps opacity.
 *
 * @param options Selects the scroll axis the indicator tracks.
 * @returns A style mixin, applicable through a host element's `mix` prop.
 * @example
 * mix={scrollProgress({ axis: "inline" })}
 */
export function scrollProgress(options: ScrollProgress.Options = {}): CSSMixinDescriptor {
	let axis = options.axis ?? DEFAULT_SCROLL_PROGRESS_AXIS;

	return supports("(animation-timeline: scroll())", [
		animation(SCROLL_PROGRESS_FILL_KEYFRAMES_NAME, {
			keyframes: {
				from: { inlineSize: "0%" },
				to: { inlineSize: "100%" },
			},
			duration: "auto",
			easing: easings.linear,
			fillMode: "both",
			timeline: `scroll(nearest ${axis})`,
		}),
		media("(prefers-reduced-motion: reduce)", [
			keyframes(SCROLL_PROGRESS_FADE_KEYFRAMES_NAME, {
				from: { opacity: 0 },
				to: { opacity: 1 },
			}),
			raw({ animationName: SCROLL_PROGRESS_FADE_KEYFRAMES_NAME }),
			is("full"),
		]),
	]);
}

/**
 * Options accepted by {@link viewReveal}.
 */
export namespace ViewReveal {
	/**
	 * Edge an element's entry motion translates in from, expressed as a
	 * logical direction so it stays correct under both writing directions.
	 * `"none"` fades the element in place.
	 */
	export type Direction = "block-start" | "block-end" | "inline-start" | "inline-end" | "none";

	/**
	 * Options tuning an element's entry motion as it scrolls into view.
	 */
	export interface Options {
		/**
		 * Logical edge the element translates in from. Defaults to
		 * `"block-end"` — the element rises into place, matching the most
		 * common reveal-on-scroll convention.
		 */
		from?: Direction;
		/**
		 * CSS length the element starts offset by. Ignored when `from` is
		 * `"none"`. Defaults to `"1.5rem"`.
		 */
		distance?: string;
		/**
		 * Scroll axis the element's view-timeline progresses along: `"block"`
		 * for a vertically scrolling page or panel, `"inline"` for a
		 * horizontally scrolling one, such as a Carousel. Defaults to `"block"`.
		 */
		axis?: "block" | "inline";
		/**
		 * Named view-timeline range the reveal completes over. Defaults to
		 * `"entry"` — the reveal finishes once the element has fully entered
		 * the scrollport and stays settled for the remainder of scroll.
		 */
		range?: string;
	}
}

/**
 * Plays a translate-and-fade entry as the element scrolls into view; out and
 * back replays it. `@keyframes` names are document-global, so one shared set
 * reads its distance from a custom property, mirrored under `:dir(rtl)`.
 *
 * @param options Tuning for the reveal's direction, distance, and range.
 * @returns A style mixin, applicable through a host element's `mix` prop.
 * @example
 * mix={viewReveal({ from: "inline-start", distance: "2rem" })}
 */
export function viewReveal(options: ViewReveal.Options = {}): CSSMixinDescriptor {
	let from = options.from ?? DEFAULT_VIEW_REVEAL_FROM;
	let distance = options.distance ?? DEFAULT_VIEW_REVEAL_DISTANCE;
	let axis = options.axis ?? DEFAULT_VIEW_REVEAL_AXIS;
	let range = options.range ?? DEFAULT_VIEW_REVEAL_RANGE;

	let negatedDistance = `calc(-1 * ${distance})`;
	let enterTranslate = "0 0";
	let enterTranslateMirrored = "0 0";
	let needsMirror = false;

	switch (from) {
		case "block-start":
			enterTranslate = `0 ${negatedDistance}`;
			enterTranslateMirrored = enterTranslate;
			break;
		case "block-end":
			enterTranslate = `0 ${distance}`;
			enterTranslateMirrored = enterTranslate;
			break;
		case "inline-start":
			enterTranslate = `${negatedDistance} 0`;
			enterTranslateMirrored = `${distance} 0`;
			needsMirror = true;
			break;
		case "inline-end":
			enterTranslate = `${distance} 0`;
			enterTranslateMirrored = `${negatedDistance} 0`;
			needsMirror = true;
			break;
		case "none":
			break;
	}

	return supports("(animation-timeline: scroll())", [
		raw({ [VIEW_REVEAL_TRANSLATE_PROPERTY]: enterTranslate }),
		animation(VIEW_REVEAL_KEYFRAMES_NAME, {
			keyframes: {
				from: { opacity: 0, translate: `var(${VIEW_REVEAL_TRANSLATE_PROPERTY}, 0 0)` },
				to: { opacity: 1, translate: "0 0" },
			},
			duration: "auto",
			easing: easings.decelerate,
			fillMode: "both",
			timeline: `view(${axis})`,
			range: range,
		}),
		needsMirror &&
			when("&:dir(rtl)", raw({ [VIEW_REVEAL_TRANSLATE_PROPERTY]: enterTranslateMirrored })),
		media("(prefers-reduced-motion: reduce)", [
			keyframes(VIEW_REVEAL_REDUCED_KEYFRAMES_NAME, {
				from: { opacity: 0 },
				to: { opacity: 1 },
			}),
			raw({ animationName: VIEW_REVEAL_REDUCED_KEYFRAMES_NAME }),
			translateProperty("0 0"),
		]),
	]);
}

/**
 * Options accepted by {@link scrollFade}.
 */
export namespace ScrollFade {
	/**
	 * Options tuning which edges a scroll container's own mask-driven fade
	 * tracks and how wide each faded band reads.
	 */
	export interface Options {
		/**
		 * Scroll axis the fade's timeline attaches to: `"block"` fades the top
		 * and bottom edges of a vertically scrolling list, `"inline"` the start
		 * and end edges of a horizontally scrolling row. Defaults to `"block"`.
		 */
		axis?: "block" | "inline";
		/**
		 * CSS length each faded band extends inward from its edge. Defaults
		 * to `"3rem"`.
		 */
		size?: string;
	}
}

/**
 * Builds the four-stop mask gradient every {@link scrollFade} state paints.
 * Collapsing a middle stop onto its neighboring fixed stop reads as a fully
 * opaque edge, so one gradient shape serves every state.
 */
function scrollFadeMask(direction: string, startStop: string, endStop: string): string {
	return `linear-gradient(${direction}, transparent 0%, black ${startStop}, black ${endStop}, transparent 100%)`;
}

/**
 * Fades a scroll container's own edges through a mask on the scrolling
 * element itself: each edge reads opaque once scroll reaches it and feathers
 * while content lies beyond. Without scroll timelines both edges stay faded.
 *
 * @param options Selects the scroll axis the fade tracks and how wide each faded band reads.
 * @returns A style mixin, applicable through a host element's `mix` prop.
 * @example
 * <MessageScroller.Viewport mix={scrollFade({ axis: "block" })}>
 * 	{messages}
 * </MessageScroller.Viewport>
 * @example
 * <Attachment.Group mix={scrollFade({ axis: "inline", size: "2rem" })}>
 * 	{attachments}
 * </Attachment.Group>
 */
export function scrollFade<node extends Element = Element>(options: ScrollFade.Options = {}) {
	let axis = options.axis ?? DEFAULT_SCROLL_FADE_AXIS;
	let size = options.size ?? DEFAULT_SCROLL_FADE_SIZE;
	let direction = SCROLL_FADE_AXIS_DIRECTION[axis];
	let settledStop = `calc(100% - ${size})`;
	let settledMask = scrollFadeMask(direction, size, settledStop);
	let rampPercent = SCROLL_FADE_RAMP_PERCENT;

	let fadeKeyframes: Record<string, CSSStyles> = {
		"0%": { maskImage: scrollFadeMask(direction, "0%", settledStop) },
		"100%": { maskImage: scrollFadeMask(direction, size, "100%") },
	};
	fadeKeyframes[`${rampPercent}%, ${100 - rampPercent}%`] = { maskImage: settledMask };

	return combine<node>([
		mask<node>(settledMask),
		axis === "inline" &&
			when<node>("&:dir(rtl)", raw<node>({ [SCROLL_FADE_DIRECTION_PROPERTY]: "left" })),
		supports<node>("(animation-timeline: scroll())", [
			animation<node>(SCROLL_FADE_KEYFRAMES_NAME, {
				keyframes: fadeKeyframes,
				duration: "auto",
				easing: easings.linear,
				fillMode: "both",
				timeline: `scroll(self ${axis})`,
			}),
			media<node>("(prefers-reduced-motion: reduce)", [
				raw<node>({ animationName: "none" }),
				mask<node>(settledMask),
			]),
		]),
	]);
}
