/**
 * Looping `@keyframes`-backed mixin factories for busy indicators: spinner,
 * skeleton breathe, indeterminate sweep, text glyph highlight. `keyframes()`
 * hoists to the stylesheet root only from a mixin's top level or from inside
 * `media()`/`supports()`, so `animationHost()` carries the `animation-*`
 * declarations `when()` gates while the keyframes stay an ungated sibling.
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

/**
 * Easing {@link spin} falls back to when `easing` is omitted; a constant
 * speed reads as a continuous loop.
 */
const DEFAULT_SPIN_EASING = easings.linear;

/** One breathe cycle length {@link pulse} falls back to when `duration` is omitted. */
const DEFAULT_PULSE_DURATION = "1.6s";

/** Easing {@link pulse} falls back to when `easing` is omitted. */
const DEFAULT_PULSE_EASING = "ease-in-out";

/** Dimmest opacity {@link pulse} falls back to when `minOpacity` is omitted. */
const DEFAULT_PULSE_MIN_OPACITY = 0.5;

/** Brightest opacity {@link pulse} falls back to when `maxOpacity` is omitted. */
const DEFAULT_PULSE_MAX_OPACITY = 1;

/**
 * Fraction of {@link pulse}'s configured opacity range a reduced-motion
 * viewer still sees, keeping the breathe perceptible at a gentler swing.
 */
const REDUCED_PULSE_AMPLITUDE_SCALE = 0.4;

/** Sweep length {@link shimmer} falls back to when `duration` is omitted. */
const DEFAULT_SHIMMER_DURATION = "1.6s";

/** Easing {@link shimmer} falls back to when `easing` is omitted. */
const DEFAULT_SHIMMER_EASING = "ease-in-out";

/** Width of the moving highlight band {@link shimmer} falls back to when `bandSize` is omitted. */
const DEFAULT_SHIMMER_BAND_SIZE = "50%";

/**
 * Gate {@link shimmer} falls back to when `when` is omitted: the platform
 * state a value-less `<progress>` carries.
 */
const DEFAULT_SHIMMER_WHEN = ":indeterminate";

/**
 * Sweep length {@link textShimmer} falls back to when `duration` is omitted;
 * a caption is read glyph by glyph, so its sweep runs slower than an
 * indicator band's.
 */
const DEFAULT_TEXT_SHIMMER_DURATION = "2s";

/**
 * Easing {@link textShimmer} falls back to when `easing` is omitted; a
 * constant speed keeps the point where the sweep wraps reading as smooth.
 */
const DEFAULT_TEXT_SHIMMER_EASING = easings.linear;

/**
 * Width of the moving highlight band {@link textShimmer} falls back to when
 * `bandSize` is omitted; a narrow band suits a run of glyphs.
 */
const DEFAULT_TEXT_SHIMMER_BAND_SIZE = "30%";

/**
 * Gradient angle the highlight band travels along, {@link textShimmer} falls
 * back to when `angle` is omitted; `90deg` sweeps along the inline axis of a
 * horizontal line of text.
 */
const DEFAULT_TEXT_SHIMMER_ANGLE = "90deg";

/**
 * Highlight color {@link textShimmer} falls back to when `color` is omitted,
 * tying the sweep to the color the caption's own styling already sets.
 */
const DEFAULT_TEXT_SHIMMER_COLOR = "currentColor";

/**
 * Fraction of {@link textShimmer}'s configured `color` mixed against
 * transparency for the resting tone, keeping the caption legible between
 * passes of the brighter band.
 */
const TEXT_SHIMMER_REST_TONE_MIX = 45;

/**
 * Turns an optional gate fragment into a host-relative selector: the bare
 * host, or the host qualified by the gate (`&${when}`).
 */
function resolveTarget(when: string | undefined): string {
	return when === undefined ? "&" : `&${when}`;
}

/**
 * Mount/gate shell every loop factory wraps its animation in: an
 * `@starting-style` fade from {@link HIDDEN_OPACITY}, an `allow-discrete`
 * transition, and a return to hidden outside the `when` gate.
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
 * Continuous 360° rotation for a busy indicator's glyph, resolved entirely to
 * `@keyframes` so it runs from server-rendered markup. Under
 * `prefers-reduced-motion: reduce`, a gentle opacity breathe carries it.
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
		 * that gates the loop. Left unset, the loop runs as soon as it is mixed
		 * in, matching a skeleton mounted only while its content loads.
		 */
		when?: string;
	}
}

/**
 * Gentle opacity breathe for a skeleton placeholder, resolved entirely to
 * `@keyframes` so it runs from server-rendered markup. Reduced motion narrows
 * the swing by overriding duration and the min-opacity token alone.
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
		 * Selector fragment, relative to the host, that gates the loop. Defaults
		 * to {@link DEFAULT_SHIMMER_WHEN}; pass a custom fragment (e.g.
		 * `[data-indeterminate="true"]`) for a hand-built progress indicator.
		 */
		when?: string;
	}
}

/**
 * Sweeping highlight band for an indeterminate progress fill, resolved
 * entirely to `@keyframes` so it runs from server-rendered markup and settles
 * once the gate clears; reduced motion breathes the fill's opacity instead.
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
		 * that gates the loop. Left unset, the loop runs as soon as it is mixed
		 * in, matching a caption mounted only while a response streams in.
		 */
		when?: string;
	}
}

/**
 * Sweeping highlight through a run of text's own glyphs for a caption that
 * stands in for a busy state. The `background-clip: text` paint sits behind
 * an `@supports` guard; reduced motion breathes the caption's opacity.
 *
 * @param options Timing, band width, angle, color, and gating for the loop.
 * @returns A `@pkg/u` mixin ready for a caption's host text element.
 * @example
 * <Text mix={[textShimmer()]}>{t("chat.generating")}</Text>
 * @example
 * <Text mix={[textShimmer({ color: "var(--ui-brand-fg)", duration: "1.5s" })]}>
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
