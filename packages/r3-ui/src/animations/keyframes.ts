/**
 * Looping `@keyframes`-backed mixin factories for indicators that keep
 * moving for as long as a busy state lasts: a rotating spinner, a breathing
 * skeleton placeholder, a sweeping indeterminate progress fill, and a
 * highlight sweeping through a run of text's own glyphs. Every factory
 * composes `@pkg/u` utilities — `keyframes()`/`animationHost()` for the
 * looping animation itself, `when()`/`media()`/`supports()`/`startingStyle()`
 * for the gating and mount transition — rather than a single hand-written
 * style object.
 *
 * `keyframes()` (and any `@keyframes` block) may only ever sit at a mixin's
 * own top level, or nested inside `media()`/`supports()` — never inside
 * `when()`. `remix/ui`'s serializer only hoists `@keyframes` to the
 * stylesheet root from those two positions; nesting one under a selector
 * produces broken CSS. `animationHost()` exists precisely so the *host*
 * `animation-*` declarations can be gated behind `when()` while the
 * `keyframes()` utility they reference stays an ungated sibling in the same
 * `mix` array.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinDescriptor } from "remix/ui";

import { animationHost, keyframes } from "@pkg/u/animation";
import { colorMix, linearGradient } from "@pkg/u/color";
import { opacity, transitionBehavior } from "@pkg/u/effects";
import { calc, combine, raw, var as varUtility } from "@pkg/u/general";
import { media, startingStyle, supports } from "@pkg/u/responsive";
import { when } from "@pkg/u/state";

import type { CSSStyles } from "../utils/css-styles";

import { easings } from "./tokens";

/** The `@pkg/u` mixin type every factory in this file returns. */
type Mixin<Node extends Element> = MixinDescriptor<Node, [styles: CSSStyles], ElementProps>;

/** Resting opacity a loop's mount-in transition fades up from and its exit fades down to. */
const HIDDEN_OPACITY = 0;

/** Fallback mount/gate transition length shared by every factory's `--ui-*-fade-duration` token. */
const DEFAULT_FADE_DURATION = "150ms";

/** Full rotation length {@link spin} falls back to when `duration` is omitted. */
const DEFAULT_SPIN_DURATION = "1s";

/** Easing {@link spin} falls back to when `easing` is omitted; constant speed reads as a loop, not a motion with an end. */
const DEFAULT_SPIN_EASING = easings.linear;

/** One breathe cycle length {@link pulse} falls back to when `duration` is omitted. */
const DEFAULT_PULSE_DURATION = "1.6s";

/** Easing {@link pulse} falls back to when `easing` is omitted. */
const DEFAULT_PULSE_EASING = "ease-in-out";

/** Dimmest opacity {@link pulse} falls back to when `minOpacity` is omitted. */
const DEFAULT_PULSE_MIN_OPACITY = 0.5;

/** Brightest opacity {@link pulse} falls back to when `maxOpacity` is omitted. */
const DEFAULT_PULSE_MAX_OPACITY = 1;

/** Fraction of {@link pulse}'s configured opacity range a reduced-motion viewer still sees, keeping the breathe visible without the full swing. */
const REDUCED_PULSE_AMPLITUDE_SCALE = 0.4;

/** Sweep length {@link shimmer} falls back to when `duration` is omitted. */
const DEFAULT_SHIMMER_DURATION = "1.6s";

/** Easing {@link shimmer} falls back to when `easing` is omitted. */
const DEFAULT_SHIMMER_EASING = "ease-in-out";

/** Width of the moving highlight band {@link shimmer} falls back to when `bandSize` is omitted. */
const DEFAULT_SHIMMER_BAND_SIZE = "50%";

/** Gate {@link shimmer} falls back to when `when` is omitted: the platform state a `<progress>` carries while it has no `value`. */
const DEFAULT_SHIMMER_WHEN = ":indeterminate";

/** Sweep length {@link textShimmer} falls back to when `duration` is omitted; a caption reads glyph by glyph rather than being glanced at as a whole, so its sweep runs slower than {@link shimmer}'s indicator band. */
const DEFAULT_TEXT_SHIMMER_DURATION = "2s";

/** Easing {@link textShimmer} falls back to when `easing` is omitted. A constant speed keeps the point where the sweep wraps from reading as a stutter — the same reasoning {@link spin} uses for its own infinite rotation. */
const DEFAULT_TEXT_SHIMMER_EASING = easings.linear;

/** Width of the moving highlight band {@link textShimmer} falls back to when `bandSize` is omitted, narrower than {@link shimmer}'s default band to suit a run of glyphs rather than a whole indicator's fill. */
const DEFAULT_TEXT_SHIMMER_BAND_SIZE = "30%";

/** Gradient angle the highlight band travels along, {@link textShimmer} falls back to when `angle` is omitted; `90deg` sweeps along the inline axis of a horizontal line of text. */
const DEFAULT_TEXT_SHIMMER_ANGLE = "90deg";

/** Highlight color {@link textShimmer} falls back to when `color` is omitted, tying the sweep to whatever color the caption's own styling already sets. */
const DEFAULT_TEXT_SHIMMER_COLOR = "currentColor";

/** Fraction of {@link textShimmer}'s configured `color` mixed against transparency for the resting tone the band sweeps away from and back into, so the caption stays legible between passes of the brighter band. */
const TEXT_SHIMMER_REST_TONE_MIX = 45;

/**
 * Turns an optional gate fragment into a selector relative to the host: the
 * host itself when no gate is given, or the host qualified by the gate
 * (`&${when}`) when one is given.
 */
function resolveTarget(when: string | undefined): string {
	return when === undefined ? "&" : `&${when}`;
}

/**
 * The mount/gate shell every loop factory wraps its keyframe animation in.
 * Fades the host in from {@link HIDDEN_OPACITY} on first render through
 * `@starting-style`, carries a `display`/`opacity` transition marked
 * `allow-discrete` so a discrete show/hide still animates smoothly, and,
 * when `when` is given, drops back to {@link HIDDEN_OPACITY} while the gate
 * does not match so the loop only shows while its state actually holds. The
 * mixed-duration transition shorthand (opacity and display each reading
 * their own custom-property fallback) has no `@pkg/u` equivalent and stays
 * a small `raw()`; the gating and mount-fade opacity values compose real
 * utilities.
 */
function loopShell<Node extends Element = Element>(
	target: string,
	when: string | undefined,
	fadeDurationVar: string,
	restOpacity: number,
) {
	return combine<Node>([
		raw<Node>({
			opacity: restOpacity,
			transition: `opacity var(${fadeDurationVar}, ${DEFAULT_FADE_DURATION}) ease, display var(${fadeDurationVar}, ${DEFAULT_FADE_DURATION}) ease-out`,
		}),
		transitionBehavior<Node>("allow-discrete"),
		when === undefined ? undefined : gate<Node>(`&:not(${when})`, opacity<Node>(HIDDEN_OPACITY)),
		startingStyle<Node>(gate<Node>(target, opacity<Node>(HIDDEN_OPACITY))),
	]);
}

/** Sugar for `when(selector, input)`, named to read alongside this file's own gating vocabulary. */
function gate<Node extends Element = Element>(
	selector: string,
	input: Parameters<typeof when<Node>>[1],
) {
	return when<Node>(selector, input);
}

/**
 * Options accepted by {@link spin}.
 */
export namespace Spin {
	/**
	 * Tuning for a spin loop: timing and the platform state it runs under.
	 */
	export interface Options {
		/** Length of one full rotation, as a CSS time. Defaults to {@link DEFAULT_SPIN_DURATION}. */
		duration?: string;
		/** CSS easing function driving the rotation. Defaults to {@link DEFAULT_SPIN_EASING}. */
		easing?: string;
		/**
		 * Selector fragment, relative to the host (e.g. `[aria-busy="true"]`),
		 * that gates the loop. Left unset, the loop runs as soon as it is
		 * mixed in, matching a spinner that is mounted only while busy.
		 */
		when?: string;
	}
}

/**
 * Continuous 360° rotation for a busy indicator's spinning glyph, resolved
 * entirely to `@keyframes` output so the rotation keeps going through
 * server-rendered markup. Under `prefers-reduced-motion: reduce`, the
 * rotation is replaced by a gentle opacity breathe so the indicator still
 * reads as active without the spin itself.
 *
 * @param options Timing and gating for the loop.
 * @returns A `@pkg/u` mixin ready for a spinner's host element.
 * @example
 * <Spinner mix={[spin()]} aria-label={t("status.loading")} />
 */
export function spin<Node extends Element = Element>(options: Spin.Options = {}): Mixin<Node> {
	let duration = options.duration ?? DEFAULT_SPIN_DURATION;
	let easing = options.easing ?? DEFAULT_SPIN_EASING;
	let when = options.when;
	let target = resolveTarget(when);

	return combine<Node>([
		loopShell<Node>(target, when, "--ui-spin-fade-duration", 1),
		keyframes<Node>("ui-spin-rotate", {
			from: { transform: "rotate(0deg)" },
			to: { transform: "rotate(360deg)" },
		}),
		keyframes<Node>("ui-spin-breathe", {
			"0%, 100%": { opacity: 1 },
			"50%": { opacity: 0.4 },
		}),
		gate<Node>(
			target,
			animationHost<Node>("ui-spin-rotate", {
				duration: varUtility("ui-spin-duration", duration),
				easing: varUtility("ui-spin-easing", easing),
				iterationCount: "infinite",
			}),
		),
		media<Node>(
			"(prefers-reduced-motion: reduce)",
			gate<Node>(
				target,
				animationHost<Node>("ui-spin-breathe", {
					duration: varUtility("ui-spin-duration", duration),
					easing: "ease-in-out",
					iterationCount: "infinite",
				}),
			),
		),
	]);
}

/**
 * Options accepted by {@link pulse}.
 */
export namespace Pulse {
	/**
	 * Tuning for a pulse loop: timing, opacity range, and the platform state
	 * it runs under.
	 */
	export interface Options {
		/** Length of one breathe cycle, as a CSS time. Defaults to {@link DEFAULT_PULSE_DURATION}. */
		duration?: string;
		/** CSS easing function driving the breathe. Defaults to {@link DEFAULT_PULSE_EASING}. */
		easing?: string;
		/** Dimmest point of the breathe, from `0` to `1`. Defaults to {@link DEFAULT_PULSE_MIN_OPACITY}. */
		minOpacity?: number;
		/** Brightest point of the breathe, from `0` to `1`. Defaults to {@link DEFAULT_PULSE_MAX_OPACITY}. */
		maxOpacity?: number;
		/**
		 * Selector fragment, relative to the host (e.g. `[aria-busy="true"]`),
		 * that gates the loop. Left unset, the loop runs as soon as it is
		 * mixed in, matching a skeleton placeholder that is mounted only
		 * while its content loads.
		 */
		when?: string;
	}
}

/**
 * Gentle opacity breathe for a skeleton placeholder, resolved entirely to
 * `@keyframes` output so the loop keeps going through server-rendered
 * markup. The animation is opacity-only already, so under
 * `prefers-reduced-motion: reduce` it keeps running with its swing narrowed
 * toward {@link Pulse.Options.maxOpacity} rather than stopping outright.
 *
 * @param options Timing, opacity range, and gating for the loop.
 * @returns A `@pkg/u` mixin ready for a skeleton placeholder's host element.
 * @example
 * <Skeleton mix={[pulse()]} aria-hidden="true" />
 */
export function pulse<Node extends Element = Element>(options: Pulse.Options = {}): Mixin<Node> {
	let duration = options.duration ?? DEFAULT_PULSE_DURATION;
	let easing = options.easing ?? DEFAULT_PULSE_EASING;
	let minOpacity = options.minOpacity ?? DEFAULT_PULSE_MIN_OPACITY;
	let maxOpacity = options.maxOpacity ?? DEFAULT_PULSE_MAX_OPACITY;
	let when = options.when;
	let target = resolveTarget(when);
	let reducedMinOpacity = maxOpacity - (maxOpacity - minOpacity) * REDUCED_PULSE_AMPLITUDE_SCALE;

	return combine<Node>([
		loopShell<Node>(target, when, "--ui-pulse-fade-duration", maxOpacity),
		keyframes<Node>("ui-pulse-breathe", {
			"0%, 100%": { opacity: `var(--ui-pulse-max-opacity, ${maxOpacity})` },
			"50%": { opacity: `var(--ui-pulse-min-opacity, ${minOpacity})` },
		}),
		gate<Node>(
			target,
			animationHost<Node>("ui-pulse-breathe", {
				duration: varUtility("ui-pulse-duration", duration),
				easing: varUtility("ui-pulse-easing", easing),
				iterationCount: "infinite",
			}),
		),
		// Only overrides the loop's duration and the keyframes' own min-opacity
		// custom property under reduced motion — the animation name/timing
		// function stay whatever the base gate() above already set, so this
		// can't route through animationHost() (which always re-asserts a name).
		media<Node>(
			"(prefers-reduced-motion: reduce)",
			gate<Node>(
				target,
				raw<Node>({
					"--ui-pulse-min-opacity": String(reducedMinOpacity),
					animationDuration: calc(`var(--ui-pulse-duration, ${duration}) * 1.5`),
				}),
			),
		),
	]);
}

/**
 * Options accepted by {@link shimmer}.
 */
export namespace Shimmer {
	/**
	 * Tuning for a shimmer loop: timing, highlight width, and the platform
	 * state it runs under.
	 */
	export interface Options {
		/** Length of one sweep across the band, as a CSS time. Defaults to {@link DEFAULT_SHIMMER_DURATION}. */
		duration?: string;
		/** CSS easing function driving the sweep. Defaults to {@link DEFAULT_SHIMMER_EASING}. */
		easing?: string;
		/** Width of the moving highlight band, as a CSS length or percentage. Defaults to {@link DEFAULT_SHIMMER_BAND_SIZE}. */
		bandSize?: string;
		/**
		 * Selector fragment, relative to the host, that gates the loop.
		 * Defaults to {@link DEFAULT_SHIMMER_WHEN}, the native indeterminate
		 * state a value-less `<progress>` already carries; pass a custom
		 * fragment (e.g. `[data-indeterminate="true"]`) for a hand-built
		 * progress indicator that tracks the same state through an attribute.
		 */
		when?: string;
	}
}

/**
 * Sweeping highlight band for an indeterminate progress indicator's fill,
 * resolved entirely to `@keyframes` output so the sweep keeps going through
 * server-rendered markup and stops on its own the moment the gated state no
 * longer matches (a `<progress>` gaining a `value`, by default). The
 * highlight color mixes `currentColor` into transparency, so it follows
 * whatever color the indicator's own styling already sets. Under
 * `prefers-reduced-motion: reduce`, the sweep is replaced by a gentle
 * opacity breathe so the indicator still reads as active without the
 * moving band.
 *
 * @param options Timing, band width, and gating for the loop.
 * @returns A `@pkg/u` mixin ready for a progress indicator's fill element.
 * @example
 * <ProgressBar.Indicator mix={[shimmer()]} />
 */
export function shimmer<Node extends Element = Element>(
	options: Shimmer.Options = {},
): Mixin<Node> {
	let duration = options.duration ?? DEFAULT_SHIMMER_DURATION;
	let easing = options.easing ?? DEFAULT_SHIMMER_EASING;
	let bandSize = options.bandSize ?? DEFAULT_SHIMMER_BAND_SIZE;
	let when = options.when ?? DEFAULT_SHIMMER_WHEN;
	let target = resolveTarget(when);

	return combine<Node>([
		loopShell<Node>(target, when, "--ui-shimmer-fade-duration", 1),
		keyframes<Node>("ui-shimmer-sweep", {
			from: { backgroundPosition: "-100% 0" },
			to: { backgroundPosition: "200% 0" },
		}),
		keyframes<Node>("ui-shimmer-breathe", {
			"0%, 100%": { opacity: 1 },
			"50%": { opacity: 0.6 },
		}),
		gate<Node>(
			target,
			combine<Node>([
				raw<Node>({
					backgroundImage: linearGradient(
						90,
						"transparent",
						colorMix("oklab", { color: "currentColor", weight: 35 }, "transparent"),
						"transparent",
					),
					backgroundRepeat: "no-repeat",
					backgroundSize: `var(--ui-shimmer-band-size, ${bandSize}) 100%`,
				}),
				animationHost<Node>("ui-shimmer-sweep", {
					duration: varUtility("ui-shimmer-duration", duration),
					easing: varUtility("ui-shimmer-easing", easing),
					iterationCount: "infinite",
				}),
			]),
		),
		media<Node>(
			"(prefers-reduced-motion: reduce)",
			gate<Node>(
				target,
				animationHost<Node>("ui-shimmer-breathe", {
					duration: varUtility("ui-shimmer-duration", duration),
					easing: "ease-in-out",
					iterationCount: "infinite",
				}),
			),
		),
	]);
}

/**
 * Options accepted by {@link textShimmer}.
 */
export namespace TextShimmer {
	/**
	 * Tuning for a text shimmer loop: timing, the highlight band's width and
	 * angle of travel, its color, and the platform state it runs under.
	 */
	export interface Options {
		/** Length of one sweep across the band, as a CSS time. Defaults to {@link DEFAULT_TEXT_SHIMMER_DURATION}. */
		duration?: string;
		/** CSS easing function driving the sweep. Defaults to {@link DEFAULT_TEXT_SHIMMER_EASING}. */
		easing?: string;
		/** Width of the moving highlight band, as a CSS length or percentage. Defaults to {@link DEFAULT_TEXT_SHIMMER_BAND_SIZE}. */
		bandSize?: string;
		/** CSS angle the highlight band travels along. Defaults to {@link DEFAULT_TEXT_SHIMMER_ANGLE}. */
		angle?: string;
		/**
		 * Color the highlight band peaks at as it passes; the tone the text
		 * rests at between passes is this same color mixed toward
		 * transparency. Defaults to {@link DEFAULT_TEXT_SHIMMER_COLOR}.
		 */
		color?: string;
		/**
		 * Selector fragment, relative to the host (e.g. `[data-streaming="true"]`),
		 * that gates the loop. Left unset, the loop runs as soon as it is
		 * mixed in, matching a caption that is mounted only while a response
		 * is streaming in.
		 */
		when?: string;
	}
}

/**
 * Sweeping highlight through a run of text's own glyphs, resolved entirely
 * to `@keyframes` output so the sweep keeps going through server-rendered
 * markup — a streaming AI response's "Generating response…" caption, or any
 * other line of text standing in for a busy state instead of a separate
 * indicator glyph. The band is painted through `background-clip: text` with
 * the glyphs' own fill made transparent, so the highlight travels across the
 * letters themselves; the same technique renders the resting tone between
 * passes, so the caption stays fully readable throughout, and a browser
 * lacking `background-clip: text` support renders the caption in its plain
 * inherited color the whole time, which stays perfectly readable on its own.
 * Under `prefers-reduced-motion: reduce`, the sweep is replaced by a gentle
 * opacity breathe over the whole caption so it still reads as active without
 * the highlight travelling across individual glyphs.
 *
 * @param options Timing, band width, angle, color, and gating for the loop.
 * @returns A `@pkg/u` mixin ready for a caption's host text element.
 * @example
 * <Text mix={[textShimmer()]}>{t("chat.generating")}</Text>
 * @example
 * <Text mix={[textShimmer({ color: "var(--ui-primary-fg)", duration: "1.5s" })]}>
 * 	{t("chat.generating")}
 * </Text>
 */
export function textShimmer<Node extends Element = Element>(
	options: TextShimmer.Options = {},
): Mixin<Node> {
	let duration = options.duration ?? DEFAULT_TEXT_SHIMMER_DURATION;
	let easing = options.easing ?? DEFAULT_TEXT_SHIMMER_EASING;
	let bandSize = options.bandSize ?? DEFAULT_TEXT_SHIMMER_BAND_SIZE;
	let angle = options.angle ?? DEFAULT_TEXT_SHIMMER_ANGLE;
	let color = options.color ?? DEFAULT_TEXT_SHIMMER_COLOR;
	let when = options.when;
	let target = resolveTarget(when);

	let angleVar = `var(--ui-text-shimmer-angle, ${angle})`;
	let bandSizeVar = `var(--ui-text-shimmer-band-size, ${bandSize})`;
	let colorVar = `var(--ui-text-shimmer-color, ${color})`;
	let restTone = colorMix(
		"oklab",
		{ color: colorVar, weight: TEXT_SHIMMER_REST_TONE_MIX },
		"transparent",
	);

	return combine<Node>([
		loopShell<Node>(target, when, "--ui-text-shimmer-fade-duration", 1),
		supports<Node>("(background-clip: text) or (-webkit-background-clip: text)", [
			keyframes<Node>("ui-text-shimmer-sweep", {
				from: { backgroundPosition: "100% 0" },
				to: { backgroundPosition: "-100% 0" },
			}),
			keyframes<Node>("ui-text-shimmer-breathe", {
				"0%, 100%": { opacity: 1 },
				"50%": { opacity: 0.6 },
			}),
			gate<Node>(
				target,
				combine<Node>([
					raw<Node>({
						backgroundImage: linearGradient(
							angleVar,
							{ color: restTone, position: "0%" },
							{ color: restTone, position: calc(`50% - (${bandSizeVar} / 2)`) },
							{ color: colorVar, position: "50%" },
							{ color: restTone, position: calc(`50% + (${bandSizeVar} / 2)`) },
							{ color: restTone, position: "100%" },
						),
						backgroundSize: "200% 100%",
						backgroundRepeat: "no-repeat",
						WebkitBackgroundClip: "text",
						backgroundClip: "text",
						WebkitTextFillColor: "transparent",
					}),
					animationHost<Node>("ui-text-shimmer-sweep", {
						duration: varUtility("ui-text-shimmer-duration", duration),
						easing: varUtility("ui-text-shimmer-easing", easing),
						iterationCount: "infinite",
					}),
				]),
			),
			media<Node>(
				"(prefers-reduced-motion: reduce)",
				gate<Node>(
					target,
					combine<Node>([
						raw<Node>({
							backgroundImage: "none",
							WebkitBackgroundClip: "border-box",
							backgroundClip: "border-box",
							WebkitTextFillColor: "currentColor",
						}),
						animationHost<Node>("ui-text-shimmer-breathe", {
							duration: varUtility("ui-text-shimmer-duration", duration),
							easing: "ease-in-out",
							iterationCount: "infinite",
						}),
					]),
				),
			),
		]),
	]);
}
