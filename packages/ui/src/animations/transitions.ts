/**
 * The core CSS-only enter/exit transition system: the `enterExit()` composer
 * and the `fade()`/`zoom()`/`slide()` presets built on top of it. Every
 * factory returns a `css()`-compatible style mixin driven entirely by
 * platform state, with no hydration and no runtime animation loop involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSMixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { CSSStyles } from "../utils/css-styles";

import { durations, easings } from "./tokens";

/**
 * Options accepted by {@link enterExit}.
 */
export namespace EnterExit {
	/**
	 * Every field describes the host's closed/exit-state value for one CSS
	 * property; the entered/open-state value is always that property's reset
	 * (`1` for opacity, `none` for `scale`/`translate`). Omitting a field
	 * leaves that property untouched, so a caller only pays for the axes it
	 * actually animates.
	 */
	export interface Options {
		/** Exit-state `opacity` (0 to 1). Omit to leave opacity untransitioned. */
		opacity?: number;
		/** Exit-state `scale` factor (e.g. `0.95`). Omit to leave scale untransitioned. */
		scale?: number;
		/** Exit-state `translate` value (e.g. `"0 0.5rem"`). Omit to leave translate untransitioned. */
		translate?: string;
		/** Transition duration in milliseconds. Defaults to `durations.normal`. */
		duration?: number;
		/** A `transition-timing-function` value. Defaults to `easings.standard`. */
		easing?: string;
		/**
		 * A selector fragment, relative to the host (e.g. `"[data-visible]"`),
		 * marking the entered state. Replaces the default `[open]` /
		 * `:popover-open` platform-state selector for hosts that carry their
		 * own custom entered-state attribute instead.
		 */
		when?: string;
	}
}

/** Resets `scale`/`translate` to their no-op initial value in the entered state. */
const RESET_TRANSFORM = "none";

/** Fallback duration used when a factory's `duration` option is omitted. */
const DEFAULT_DURATION_MS: number = durations.normal;

/** Fallback timing function used when a factory's `easing` option is omitted. */
const DEFAULT_EASING: string = easings.standard;

/**
 * Default entered-state selector: matches the `open` attribute shared by
 * `<dialog open>` and `<details open>`, and the `:popover-open` pseudo-class
 * carried by elements with the `popover` attribute while shown.
 */
const DEFAULT_ENTERED_SELECTOR = "&[open], &:popover-open";

/**
 * Composes a CSS-only enter/exit transition mixin. Emits the closed/exit
 * declarations on the host itself, the entered declarations under the
 * `[open]`/`:popover-open` selector (or a custom `when` selector), an
 * `@starting-style` block so the very first paint after the host becomes
 * entered animates from the exit values instead of snapping in, and a
 * `@media (prefers-reduced-motion: reduce)` override that drops `scale`/
 * `translate` from the transition and leaves only the opacity fade.
 *
 * This mixin owns the host's `transition` property outright. Apply exactly
 * one animation factory per host — composing two here means two `css()`
 * mixins each declaring `transition`, which is a conflict, not a merge.
 * Combine every axis a single host needs (opacity, scale, translate) through
 * one `enterExit()` call instead.
 *
 * @param options Which axes to animate, the timing, and the entered-state selector.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <div id="filters" popover="auto" mix={enterExit({ opacity: 0, scale: 0.95, duration: 150 })}>
 * 	...
 * </div>;
 * @example
 * // A custom entered-state attribute instead of platform open state.
 * <div data-visible mix={enterExit({ opacity: 0, when: "[data-visible]" })}>...</div>;
 */
export function enterExit(options: EnterExit.Options = {}): CSSMixinDescriptor {
	let duration = options.duration ?? DEFAULT_DURATION_MS;
	let easing = options.easing ?? DEFAULT_EASING;
	let entered = options.when ? `&${options.when}` : DEFAULT_ENTERED_SELECTOR;

	let transitionProperties: string[] = [];
	// Exit/closed-state and entered/open-state declarations for whichever axes
	// were requested. `scale` is stringified (never left a bare number) so the
	// CSS serializer never mistakes a unitless scale factor for a length and
	// appends "px" to it.
	let exitState: CSSStyles = {};
	let enteredState: CSSStyles = {};
	// Reduced-motion resets scale/translate on the base (exit-state) rule back
	// to "no offset". The entered/open rule already rests at "none" regardless
	// of motion preference, so only the exit side needs an override here.
	let reducedMotion: CSSStyles = {};

	if (options.opacity !== undefined) {
		transitionProperties.push("opacity");
		exitState.opacity = options.opacity;
		enteredState.opacity = 1;
	}
	if (options.scale !== undefined) {
		transitionProperties.push("scale");
		exitState.scale = String(options.scale);
		enteredState.scale = RESET_TRANSFORM;
		reducedMotion.scale = RESET_TRANSFORM;
	}
	if (options.translate !== undefined) {
		transitionProperties.push("translate");
		exitState.translate = options.translate;
		enteredState.translate = RESET_TRANSFORM;
		reducedMotion.translate = RESET_TRANSFORM;
	}
	// `display`/`overlay` ride along on every host so the platform can hold the
	// previous frame in place for the duration instead of unmounting instantly;
	// `allow-discrete` is what makes those otherwise-unanimatable properties
	// eligible for a transition at all. Listing them for hosts that never
	// change `display`/`overlay` (a plain `[data-visible]`-gated element) is a
	// harmless no-op.
	transitionProperties.push("display", "overlay");

	let startingStyle: CSSStyles = {};
	startingStyle[entered] = exitState;

	reducedMotion.transitionProperty = transitionProperties
		.filter((property) => property !== "scale" && property !== "translate")
		.join(", ");

	// Copied onto a fresh object with `Object.assign` rather than spread into
	// one: `exitState` doubles as the `@starting-style` block and must stay free
	// of the transition declarations, and `CSSStyles` inherits a `Symbol.iterator`
	// key from `CSSStyleDeclaration`, so spreading one reads as spreading an
	// iterable even though a declaration block never is one.
	let output: CSSStyles = Object.assign({}, exitState, {
		transitionProperty: transitionProperties.join(", "),
		transitionDuration: `${duration}ms`,
		transitionTimingFunction: easing,
		transitionBehavior: "allow-discrete",
		"@starting-style": startingStyle,
		"@media (prefers-reduced-motion: reduce)": reducedMotion,
	});
	output[entered] = enteredState;

	return css(output);
}

/**
 * Options accepted by {@link fade}.
 */
export namespace Fade {
	export interface Options {
		/** Exit-state opacity (0 to 1). Defaults to `0` — fully transparent when closed. */
		opacity?: number;
		/** Transition duration in milliseconds. Defaults to `durations.normal`. */
		duration?: number;
		/** A `transition-timing-function` value. Defaults to `easings.standard`. */
		easing?: string;
		/** A selector fragment overriding the default `[open]`/`:popover-open` entered state. */
		when?: string;
	}
}

/** Fallback exit-state opacity for {@link fade}. */
const DEFAULT_FADE_OPACITY = 0;

/**
 * An opacity-only enter/exit transition: sugar over {@link enterExit} for the
 * common case of a surface that only needs to fade, with no movement at all.
 *
 * @param options Exit-state opacity, timing, and entered-state selector.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <div id="tooltip-1" popover="hint" mix={fade({ duration: durations.fast })}>
 * 	Copied!
 * </div>;
 */
export function fade(options: Fade.Options = {}): CSSMixinDescriptor {
	return enterExit({
		opacity: options.opacity ?? DEFAULT_FADE_OPACITY,
		duration: options.duration,
		easing: options.easing,
		when: options.when,
	});
}

/**
 * Options accepted by {@link zoom}.
 */
export namespace Zoom {
	export interface Options {
		/** Exit-state opacity (0 to 1). Defaults to `0`. */
		opacity?: number;
		/** Exit-state scale factor (e.g. `0.95`). Defaults to `0.95`. */
		scale?: number;
		/** Transition duration in milliseconds. Defaults to `durations.normal`. */
		duration?: number;
		/** A `transition-timing-function` value. Defaults to `easings.standard`. */
		easing?: string;
		/** A selector fragment overriding the default `[open]`/`:popover-open` entered state. */
		when?: string;
	}
}

/** Fallback exit-state opacity for {@link zoom}. */
const DEFAULT_ZOOM_OPACITY = 0;

/** Fallback exit-state scale factor for {@link zoom}. */
const DEFAULT_ZOOM_SCALE = 0.95;

/**
 * A fade paired with a scale, entering from slightly smaller than rest and
 * exiting back down to it: sugar over {@link enterExit} for the dialog/menu/
 * popover "pop" that most overlay surfaces in the catalog use by default.
 *
 * @param options Exit-state opacity and scale, timing, and entered-state selector.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <dialog id="confirm-delete" mix={zoom({ scale: 0.9, duration: durations.normal })}>
 * 	...
 * </dialog>;
 */
export function zoom(options: Zoom.Options = {}): CSSMixinDescriptor {
	return enterExit({
		opacity: options.opacity ?? DEFAULT_ZOOM_OPACITY,
		scale: options.scale ?? DEFAULT_ZOOM_SCALE,
		duration: options.duration,
		easing: options.easing,
		when: options.when,
	});
}

/**
 * Options accepted by {@link slide}.
 */
export namespace Slide {
	/** Which edge the host travels in from (and back out toward on exit). */
	export type From = "top" | "right" | "bottom" | "left";

	export interface Options {
		/** Which edge the host travels in from (and back out toward on exit). */
		from: From;
		/** How far the exit state is offset along that edge. Defaults to `"0.5rem"`. */
		distance?: string;
		/** Exit-state opacity (0 to 1). Defaults to `0`. */
		opacity?: number;
		/** Transition duration in milliseconds. Defaults to `durations.normal`. */
		duration?: number;
		/** A `transition-timing-function` value. Defaults to `easings.standard`. */
		easing?: string;
		/** A selector fragment overriding the default `[open]`/`:popover-open` entered state. */
		when?: string;
	}
}

/** Fallback exit-state opacity for {@link slide}. */
const DEFAULT_SLIDE_OPACITY = 0;

/** Fallback exit-state offset distance for {@link slide}. */
const DEFAULT_SLIDE_DISTANCE = "0.5rem";

/** Builds the exit-state `translate` value that offsets the host toward the given edge. */
function offsetFor(from: Slide.From, distance: string): string {
	switch (from) {
		case "top":
			return `0 -${distance}`;
		case "bottom":
			return `0 ${distance}`;
		case "left":
			return `-${distance} 0`;
		case "right":
			return `${distance} 0`;
	}
}

/**
 * A fade paired with a directional offset, entering from just off one edge
 * of its resting position and exiting back toward it: sugar over
 * {@link enterExit} for Sheet, Drawer, and NavigationMenu-style surfaces.
 *
 * @param options Which edge to travel from, the offset distance, opacity, timing, and entered-state selector.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <dialog id="cart-drawer" mix={slide({ from: "right", duration: durations.slow })}>
 * 	...
 * </dialog>;
 */
export function slide(options: Slide.Options): CSSMixinDescriptor {
	let { from, distance, opacity, duration, easing, when } = options;

	return enterExit({
		opacity: opacity ?? DEFAULT_SLIDE_OPACITY,
		translate: offsetFor(from, distance ?? DEFAULT_SLIDE_DISTANCE),
		duration,
		easing,
		when,
	});
}
