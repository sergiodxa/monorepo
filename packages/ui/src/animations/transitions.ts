/**
 * The core CSS-only enter/exit transition system: the `enterExit()` composer
 * and the `fade()`/`zoom()`/`slide()` presets built on top of it. Every
 * factory returns a `css()`-compatible style mixin driven entirely by
 * platform state; exits run shorter and travel less than entries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSMixinDescriptor } from "remix/component";

import { css } from "remix/component";

import type { CSSStyles } from "../utils/css-styles.js";

import { durations, easings } from "./tokens.js";

/**
 * Options accepted by {@link enterExit}.
 */
export namespace EnterExit {
	/**
	 * The off-stage value of each animated CSS property; the entered state is
	 * always that property's reset (`1` for opacity, `none` for `scale`,
	 * `translate` and `filter`). Omitted fields leave their property as is.
	 */
	export interface Values {
		/** Off-stage `opacity`, 0 to 1. */
		opacity?: number;
		/** Off-stage `scale` factor, e.g. `0.95`. */
		scale?: number;
		/** Off-stage `translate` value, e.g. `"0 0.5rem"`. */
		translate?: string;
		/** Off-stage `filter: blur()` radius in pixels, e.g. `4`. */
		blur?: number;
	}

	/**
	 * The top-level values are where the host enters from. `exit` overrides
	 * any of them for where it leaves to, and a property only `exit` names
	 * enters from its reset, so a surface can blur away without blurring in.
	 */
	export interface Options extends Values {
		/** Where the host leaves to, per property; each omitted field reuses its entry value. */
		exit?: Values;
		/** Entry duration in milliseconds. Defaults to `durations.normal`. */
		duration?: number;
		/** A `transition-timing-function` value for the entry. Defaults to `easings.standard`. */
		easing?: string;
		/** Exit duration in milliseconds. Defaults to three quarters of `duration`. */
		exitDuration?: number;
		/** A `transition-timing-function` value for the exit. Defaults to `easing`. */
		exitEasing?: string;
		/**
		 * A selector fragment relative to the host (e.g. `"[data-visible]"`)
		 * marking the entered state, replacing the `[open]`/`:popover-open`
		 * default for hosts that carry their own entered-state attribute.
		 */
		when?: string;
	}
}

const RESET_TRANSFORM = "none";

const RESET_FILTER = "none";

const DEFAULT_DURATION_MS: number = durations.normal;

const DEFAULT_EASING: string = easings.standard;

/**
 * Share of the entry duration an exit takes by default: leaving is the
 * moment the reader has already moved on from, so it resolves sooner than
 * the arrival they were waiting for.
 */
const EXIT_DURATION_RATIO = 0.75;

/** Properties whose motion `prefers-reduced-motion: reduce` removes, keeping only opacity. */
const MOTION_PROPERTIES: ReadonlySet<string> = new Set(["scale", "translate", "filter"]);

/**
 * Default entered-state selector: matches the `open` attribute shared by
 * `<dialog open>` and `<details open>`, and the `:popover-open` pseudo-class
 * carried by elements with the `popover` attribute while shown.
 */
const DEFAULT_ENTERED_SELECTOR = "&[open], &:popover-open";

/**
 * The CSS declaration each {@link EnterExit.Values} field animates, in the
 * order they are listed in `transition-property`, with the declared value
 * for an off-stage value and for the entered state.
 */
const CHANNELS = [
	{
		key: "opacity",
		property: "opacity",
		value: (value: number | string) => value,
		reset: 1,
	},
	{
		key: "scale",
		property: "scale",
		value: (value: number | string) => String(value),
		reset: RESET_TRANSFORM,
	},
	{
		key: "translate",
		property: "translate",
		value: (value: number | string) => value,
		reset: RESET_TRANSFORM,
	},
	{
		key: "blur",
		property: "filter",
		value: (value: number | string) => `blur(${value}px)`,
		reset: RESET_FILTER,
	},
] as const;

/**
 * Composes a CSS-only enter/exit transition mixin: `@starting-style` paints
 * the first entered frame from the entry values, and closing transitions to
 * the exit values on the exit timing. Every change is a transition, so a
 * reversal mid-flight retargets smoothly. Owns the host's `transition`, so
 * apply exactly one animation factory per host.
 *
 * @param options Entry and exit values, their timing, and the entered-state selector.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <div id="filters" popover="auto" mix={enterExit({ opacity: 0, scale: 0.95, duration: 150 })}>
 * 	...
 * </div>;
 * @example
 * <div data-visible mix={enterExit({ opacity: 0, when: "[data-visible]" })}>...</div>;
 * @example
 * <dialog mix={enterExit({ translate: "100% 0", exit: { translate: "1rem 0", opacity: 0, blur: 4 } })}>...</dialog>;
 */
export function enterExit(options: EnterExit.Options = {}): CSSMixinDescriptor {
	let duration = options.duration ?? DEFAULT_DURATION_MS;
	let easing = options.easing ?? DEFAULT_EASING;
	let exitDuration = options.exitDuration ?? Math.round(duration * EXIT_DURATION_RATIO);
	let exitEasing = options.exitEasing ?? easing;
	let exit = options.exit ?? {};
	let entered = options.when ? `&${options.when}` : DEFAULT_ENTERED_SELECTOR;

	let transitionProperties: string[] = [];
	let entryState: CSSStyles = {};
	let exitState: CSSStyles = {};
	let enteredState: CSSStyles = {};
	let reducedMotion: CSSStyles = {};

	for (let channel of CHANNELS) {
		let entry = options[channel.key];
		let leave = exit[channel.key] ?? entry;
		if (entry === undefined && leave === undefined) continue;

		transitionProperties.push(channel.property);
		Object.assign(entryState, {
			[channel.property]: entry === undefined ? channel.reset : channel.value(entry),
		});
		Object.assign(exitState, {
			[channel.property]: leave === undefined ? channel.reset : channel.value(leave),
		});
		Object.assign(enteredState, { [channel.property]: channel.reset });
		if (MOTION_PROPERTIES.has(channel.property)) {
			Object.assign(reducedMotion, { [channel.property]: channel.reset });
		}
	}
	transitionProperties.push("display", "overlay");

	let startingStyle: CSSStyles = {};
	startingStyle[entered] = entryState;

	reducedMotion.transitionProperty = transitionProperties
		.filter((property) => !MOTION_PROPERTIES.has(property))
		.join(", ");

	let output: CSSStyles = Object.assign({}, exitState, {
		transitionProperty: transitionProperties.join(", "),
		transitionDuration: `${exitDuration}ms`,
		transitionTimingFunction: exitEasing,
		transitionBehavior: "allow-discrete",
		"@starting-style": startingStyle,
		"@media (prefers-reduced-motion: reduce)": reducedMotion,
	});
	output[entered] = Object.assign(enteredState, {
		transitionDuration: `${duration}ms`,
		transitionTimingFunction: easing,
	});

	return css(output);
}

/**
 * Options accepted by {@link fade}.
 */
export namespace Fade {
	export interface Options {
		/** Exit-state opacity (0 to 1). Defaults to `0` — fully transparent when closed. */
		opacity?: number;
		/** Blur radius in pixels the host softens from and to while it fades. */
		blur?: number;
		/** Transition duration in milliseconds. Defaults to `durations.normal`. */
		duration?: number;
		/** A `transition-timing-function` value. Defaults to `easings.standard`. */
		easing?: string;
		/** A selector fragment overriding the default `[open]`/`:popover-open` entered state. */
		when?: string;
	}
}

const DEFAULT_FADE_OPACITY = 0;

/**
 * An opacity-only enter/exit transition: sugar over {@link enterExit} for a
 * surface that fades in place.
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
		blur: options.blur,
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
		/** Scale factor the host enters from (e.g. `0.95`). Defaults to `0.95`. */
		scale?: number;
		/** Blur radius in pixels the host softens from and to while it scales. */
		blur?: number;
		/** Transition duration in milliseconds. Defaults to `durations.normal`. */
		duration?: number;
		/** A `transition-timing-function` value. Defaults to `easings.standard`. */
		easing?: string;
		/** A selector fragment overriding the default `[open]`/`:popover-open` entered state. */
		when?: string;
	}
}

const DEFAULT_ZOOM_OPACITY = 0;

const DEFAULT_ZOOM_SCALE = 0.95;

/**
 * A fade paired with a scale, entering from slightly smaller than rest and
 * exiting halfway back down to it, so leaving reads quieter than arriving:
 * sugar over {@link enterExit} for the dialog/menu/popover "pop".
 *
 * @param options Exit-state opacity and scale, timing, and entered-state selector.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <dialog id="confirm-delete" mix={zoom({ scale: 0.9, duration: durations.normal })}>
 * 	...
 * </dialog>;
 */
export function zoom(options: Zoom.Options = {}): CSSMixinDescriptor {
	let scale = options.scale ?? DEFAULT_ZOOM_SCALE;

	return enterExit({
		opacity: options.opacity ?? DEFAULT_ZOOM_OPACITY,
		scale,
		blur: options.blur,
		exit: { scale: Number((1 - (1 - scale) / 2).toFixed(4)) },
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
		from: From;
		/** How far off its resting position the host enters from. Defaults to `"0.5rem"`; the exit travels half of it. */
		distance?: string;
		/** Blur radius in pixels the host softens from and to while it travels. */
		blur?: number;
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

const DEFAULT_SLIDE_OPACITY = 0;

const DEFAULT_SLIDE_DISTANCE = "0.5rem";

/** Matches a plain signed length (`0.5rem`, `12px`, `50%`) whose number can be halved directly. */
const PLAIN_LENGTH = /^(\d*\.?\d+)([a-z%]*)$/i;

/** Negates a length, keeping a plain length readable (`-0.5rem`) and wrapping anything else in `calc()`. */
function negate(distance: string): string {
	return PLAIN_LENGTH.test(distance) ? `-${distance}` : `calc(-1 * ${distance})`;
}

/** Halves a length, keeping a plain length readable (`0.25rem`) and wrapping anything else in `calc()`. */
function halve(distance: string): string {
	let match = PLAIN_LENGTH.exec(distance);
	return match ? `${Number(match[1]) / 2}${match[2]}` : `calc(${distance} / 2)`;
}

/** Builds the `translate` value that offsets the host toward the given edge. */
function offsetFor(from: Slide.From, distance: string): string {
	switch (from) {
		case "top":
			return `0 ${negate(distance)}`;
		case "bottom":
			return `0 ${distance}`;
		case "left":
			return `${negate(distance)} 0`;
		case "right":
			return `${distance} 0`;
	}
}

/**
 * A fade paired with a directional offset, entering from just off one edge
 * of its resting position and exiting half that distance back toward it, so
 * leaving reads quieter than arriving: sugar over {@link enterExit}.
 *
 * @param options Which edge to travel from, the offset distance, opacity, timing, and entered-state selector.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <dialog id="cart-drawer" mix={slide({ from: "right", duration: durations.slow })}>
 * 	...
 * </dialog>;
 */
export function slide(options: Slide.Options): CSSMixinDescriptor {
	let { from, distance, opacity, blur, duration, easing, when } = options;
	let resolvedDistance = distance ?? DEFAULT_SLIDE_DISTANCE;

	return enterExit({
		opacity: opacity ?? DEFAULT_SLIDE_OPACITY,
		translate: offsetFor(from, resolvedDistance),
		blur,
		exit: { translate: offsetFor(from, halve(resolvedDistance)) },
		duration,
		easing,
		when,
	});
}
