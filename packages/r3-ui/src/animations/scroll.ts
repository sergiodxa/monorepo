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
import { combine, raw } from "@pkg/u/general";
import { media, supports } from "@pkg/u/responsive";
import { when } from "@pkg/u/state";

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
// Proportion of the tracked scroll range each edge's fade takes to ramp
// fully in (scrolling away from that edge) or fully out (scrolling back
// toward it). A fixed proportion rather than a fixed length, since the
// scroll-linked keyframes below are positioned in percentages of whatever
// range the container's own content happens to scroll.
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
 * Gives a sticky header or toolbar a shadow that ramps in once the content
 * beneath it starts scrolling, so the element reads as elevated above the
 * page only once there is something to be elevated above. The shadow tracks
 * the nearest scrollable ancestor's block-axis position directly — no
 * scroll listener runs to compute it.
 *
 * A browser without scroll-driven animation support renders the element
 * with no shadow at all times, which stays a fully usable, if less
 * decorated, sticky header.
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
		}),
		// `animationTimeline`/`animationRange` are scroll-timeline-specific —
		// no `@pkg/u` utility covers them.
		raw({
			animationTimeline: "scroll(nearest block)",
			animationRange: `0 ${distance}`,
		}),
		// A shadow ramping in and out has no positional movement to collapse
		// to opacity — the closest reduced-motion equivalent is to stop
		// tying its presence to scroll position at all and let it settle
		// permanently into the state it would otherwise scroll toward.
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
		 * vertical scroll (a reading-progress bar), `"inline"` tracks
		 * horizontal scroll (a Carousel viewport's progress). Defaults to
		 * `"block"`.
		 */
		axis?: "block" | "inline";
	}
}

/**
 * Grows a fill element from empty to full in lockstep with how far its
 * nearest scrollable ancestor has scrolled — a reading-progress bar tied to
 * page scroll, or a Carousel's progress bar tied to its viewport's scroll.
 * The fill grows along the inline dimension starting from the inline-start
 * edge, so it reads correctly in both left-to-right and right-to-left
 * layouts without any extra styling.
 *
 * Apply this to the fill element itself, nested inside a fixed-size track
 * element the consumer supplies. A browser without scroll-driven animation
 * support renders the fill at whatever static size its own CSS gives it.
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
		}),
		// `animationTimeline` is scroll-timeline-specific — no `@pkg/u` utility
		// covers it.
		raw({ animationTimeline: `scroll(nearest ${axis})` }),
		// Collapses the growing fill to a fixed full size and expresses the
		// same scroll-linked progress as an opacity ramp instead. Only
		// `animationName`/`inlineSize` are overridden here — duration, easing,
		// and fill-mode still cascade from the rule above.
		media("(prefers-reduced-motion: reduce)", [
			keyframes(SCROLL_PROGRESS_FADE_KEYFRAMES_NAME, {
				from: { opacity: 0 },
				to: { opacity: 1 },
			}),
			raw({
				animationName: SCROLL_PROGRESS_FADE_KEYFRAMES_NAME,
				inlineSize: "100%",
			}),
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
	 * `"none"` fades the element in place with no translation at all.
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
		 * Scroll axis of the element's nearest scrollable ancestor that its
		 * view-timeline progresses along: `"block"` for a vertically
		 * scrolling page or panel, `"inline"` for a horizontally scrolling
		 * one, such as a Carousel. Defaults to `"block"`.
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
 * Plays an element's entry motion as it scrolls into its nearest scrollable
 * ancestor's viewport: a translate-and-fade tied directly to the element's
 * own position, with no intersection observer and no re-render involved.
 * Because the motion is driven purely by geometry, scrolling an already
 * revealed element back out of view and back in replays it — an accepted
 * trade-off for an effect that a browser without scroll-driven animation
 * support simply skips, rendering the element fully visible and in place
 * from the start.
 *
 * The entry translate rides a custom property rather than baking the
 * distance into per-call `@keyframes`, so every call shares one set of
 * keyframes and only the custom property's value differs per element —
 * `@keyframes` names are global to the document, and a name generated fresh
 * per call would either collide across differently configured calls or
 * demand ever-growing bookkeeping to keep them apart.
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
	// Physical translate values assuming left-to-right inline flow; the
	// inline-start/inline-end cases override the custom property under
	// `:dir(rtl)` below rather than expressing a logical translate directly,
	// since `translate` itself only ever accepts physical x/y offsets.
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
		}),
		// `animationTimeline`/`animationRange` are scroll-timeline-specific —
		// no `@pkg/u` utility covers them.
		raw({ animationTimeline: `view(${axis})`, animationRange: range }),
		needsMirror &&
			when("&:dir(rtl)", raw({ [VIEW_REVEAL_TRANSLATE_PROPERTY]: enterTranslateMirrored })),
		// Collapses the translate to a fixed resting position and keeps
		// only the opacity fade, per the reduced-motion contract.
		media("(prefers-reduced-motion: reduce)", [
			keyframes(VIEW_REVEAL_REDUCED_KEYFRAMES_NAME, {
				from: { opacity: 0 },
				to: { opacity: 1 },
			}),
			raw({
				animationName: VIEW_REVEAL_REDUCED_KEYFRAMES_NAME,
				translate: "0 0",
			}),
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
		 * Scroll axis the fade's timeline attaches to: `"block"` fades the
		 * container's top and bottom edges, matching a vertically scrolling
		 * list or panel; `"inline"` fades its start and end edges, matching a
		 * horizontally scrolling row. Defaults to `"block"`.
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
 * Builds the four-stop mask-image gradient {@link scrollFade} paints in
 * every state: a leading stop, two middle stops marking where a faded band
 * gives way to the fully opaque middle, and a trailing stop. Only the two
 * middle stops ever change between states — collapsing a middle stop onto
 * its neighboring fixed stop is what reads as "no fade" at that edge, so
 * every state shares the same four-stop shape and no state needs its own
 * differently structured gradient.
 */
function scrollFadeMask(direction: string, startStop: string, endStop: string): string {
	return `linear-gradient(${direction}, transparent 0%, black ${startStop}, black ${endStop}, transparent 100%)`;
}

/**
 * Fades a scroll container's own edges through a mask that tracks its scroll
 * position directly: an edge reads fully opaque exactly when there is
 * nothing further to scroll toward it, and feathers into a transparent taper
 * the moment there is content beyond it worth hinting at. The mask lives on
 * the scrolling element itself — a MessageScroller viewport, an Attachment
 * group's row, a ScrollArea viewport, or any other element that scrolls its
 * own content — with no separately tracked element involved.
 *
 * A browser without scroll-driven animation support renders both edges
 * permanently faded instead, a constant hint that the container holds more
 * content than currently fits.
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

	// Built as its own statement, with the ramp stop's key assigned after the
	// literal "0%"/"100%" keys, rather than inline inside the `animation()`
	// call: an object literal mixing a computed key with literal ones widens
	// past what `AnimationConfig["keyframes"]` accepts, where an
	// already-typed variable assigned into afterward does not.
	let fadeKeyframes: Record<string, CSSStyles> = {
		"0%": { maskImage: scrollFadeMask(direction, "0%", settledStop) },
		"100%": { maskImage: scrollFadeMask(direction, size, "100%") },
	};
	fadeKeyframes[`${rampPercent}%, ${100 - rampPercent}%`] = { maskImage: settledMask };

	return combine<node>([
		// Static two-edge fallback, active unconditionally: both edges read
		// as permanently faded, so a container without scroll-driven
		// animation support still hints that its content extends past what
		// currently fits, even without tracking where the reader has
		// scrolled to. `mask-image` has no `@pkg/u` utility.
		raw<node>({ maskImage: settledMask, "-webkit-mask-image": settledMask }),
		axis === "inline" &&
			when<node>("&:dir(rtl)", raw<node>({ [SCROLL_FADE_DIRECTION_PROPERTY]: "left" })),
		supports<node>("(animation-timeline: scroll())", [
			animation<node>(SCROLL_FADE_KEYFRAMES_NAME, {
				keyframes: fadeKeyframes,
				duration: "auto",
				easing: easings.linear,
				fillMode: "both",
			}),
			// `animationTimeline` is scroll-timeline-specific — no `@pkg/u`
			// utility covers it.
			raw<node>({ animationTimeline: `scroll(self ${axis})` }),
			// A mask fade ramping in and out at each edge has no positional
			// movement to collapse to opacity — the closest reduced-motion
			// equivalent is to stop tying the fade to scroll position and let
			// both edges settle permanently into the same faded state the
			// static fallback above already renders.
			media<node>(
				"(prefers-reduced-motion: reduce)",
				raw<node>({
					animationName: "none",
					maskImage: settledMask,
					"-webkit-mask-image": settledMask,
				}),
			),
		]),
	]);
}
