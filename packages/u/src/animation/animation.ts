/**
 * The primitive animation composer: it emits an `@keyframes` rule and the
 * host `animation-*` declarations that reference it together, in one mixin.
 * It does not introduce animation opinions such as fade, slide, scale, spin,
 * or shimmer recipes; it only provides CSS keyframe emission and animation
 * declaration composition. Named recipes belong in `r3-ui/animations` or a
 * future animation package built on top of this layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { compose, utility } from "../internal/descriptor";

import { keyframes } from "./keyframes";

/**
 * The keyframes, duration, and optional easing/delay/iteration/direction/
 * fill-mode shared by both `animation()` call shapes.
 */
export interface AnimationConfig {
	keyframes: Record<string, CSSStyles>;
	duration: string;
	easing?: string;
	/** Sets `animationDelay` (e.g. `"150ms"`). Omitted (platform default `0s`) when not given. */
	delay?: string;
	/** Sets `animationIterationCount` (e.g. `"infinite"`, `2`). Omitted (platform default `1`) when not given. */
	iterationCount?: string | number;
	/** Sets `animationDirection` (e.g. `"alternate"`, `"reverse"`). Omitted (platform default `"normal"`) when not given. */
	direction?: string;
	/** Sets `animationFillMode` (e.g. `"both"`, `"forwards"`). Omitted (platform default `"none"`) when not given. */
	fillMode?: string;
	/** Sets `animationTimeline` (e.g. `"scroll()"`, `"view()"`, or a named `--custom-timeline`). Omitted (platform default `"auto"`) when not given. */
	timeline?: string;
	/** Sets `animationRange` (e.g. `"entry 0% cover 40%"`). Omitted (platform default `"normal"`) when not given. */
	range?: string;
}

/**
 * Emits an `@keyframes` rule under `name` plus host `animationName`,
 * `animationDuration`, and (when given) `animationTimingFunction`,
 * `animationDelay`, `animationIterationCount`, `animationDirection`,
 * `animationFillMode`, `animationTimeline`, and `animationRange` declarations
 * that reference it. Use the named form when the animation name is useful for
 * debugging in devtools.
 *
 * @example
 * u.animation("fade-in", {
 *   keyframes: {
 *     from: { opacity: 0 },
 *     to: { opacity: 1 },
 *   },
 *   duration: "150ms",
 *   easing: "ease-out",
 * });
 * @example css({
 *   "@keyframes fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
 *   animationName: "fade-in",
 *   animationDuration: "150ms",
 *   animationTimingFunction: "ease-out",
 * })
 * @example
 * u.animation("fade-in", {
 *   keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
 *   duration: "150ms",
 *   delay: "150ms",
 * });
 * @example css({
 *   "@keyframes fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
 *   animationName: "fade-in",
 *   animationDuration: "150ms",
 *   animationDelay: "150ms",
 * })
 */
export function animation<Node extends Element = Element>(
	name: string,
	config: AnimationConfig,
): UtilityMixin<Node>;
/**
 * Emits the same `@keyframes` rule and host `animation-*` declarations as
 * the named form, but generates a stable name from the keyframe content
 * instead of taking one. Identical `keyframes` content always generates the
 * identical name, so use this form for one-off animations that don't need a
 * debuggable name.
 *
 * @example
 * u.animation({
 *   keyframes: {
 *     from: { opacity: 0 },
 *     to: { opacity: 1 },
 *   },
 *   duration: "150ms",
 *   easing: "ease-out",
 * });
 */
export function animation<Node extends Element = Element>(
	config: AnimationConfig,
): UtilityMixin<Node>;
export function animation<Node extends Element = Element>(
	nameOrConfig: string | AnimationConfig,
	maybeConfig?: AnimationConfig,
): UtilityMixin<Node> {
	let named = typeof nameOrConfig === "string";
	let config = named ? (maybeConfig as AnimationConfig) : (nameOrConfig as AnimationConfig);
	let name = named ? (nameOrConfig as string) : generateName(config.keyframes);

	let keyframesUtility = keyframes<Node>(name, config.keyframes);
	let hostUtility = utility<Node>(() => hostDeclarations(name, config));

	return compose<Node>([keyframesUtility, hostUtility], (styles) => styles);
}

/**
 * Emits just the host `animation-*` declarations `animation()` would —
 * `animationName`/`animationDuration` plus whichever optional fields are
 * given (it takes every {@link AnimationConfig} key except `keyframes`, so
 * `delay`, `timeline`, and `range` all work here too) — with NO accompanying
 * `@keyframes` rule. This is the primitive
 * `animation()` is sugar over, for call sites that need to compose the
 * keyframes and the host declarations separately: a loop that gates its
 * running state behind a selector (`u.when("&[data-busy]", u.animationHost(...))`)
 * must never pass the keyframes utility itself through `when()` — nesting an
 * `@keyframes` rule under a selector produces broken CSS, since keyframes
 * only hoist to the stylesheet root from a mixin's own top level (or from
 * inside `u.media()`/`u.supports()`, which are safe). Pair this with a
 * sibling `u.keyframes(name, frames)` call in the same `mix` array instead.
 *
 * @example
 * <div
 *   mix={[
 *     u.keyframes("ui-spin-rotate", { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } }),
 *     u.when("&[data-busy]", u.animationHost("ui-spin-rotate", { duration: "1s", iterationCount: "infinite" })),
 *   ]}
 * />
 * @example css({
 *   "@keyframes ui-spin-rotate": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
 *   "&[data-busy]": { animationName: "ui-spin-rotate", animationDuration: "1s", animationIterationCount: "infinite" },
 * })
 */
export function animationHost<Node extends Element = Element>(
	name: string,
	config: Omit<AnimationConfig, "keyframes">,
): UtilityMixin<Node> {
	return utility<Node>(() => hostDeclarations(name, config as AnimationConfig));
}

function hostDeclarations(name: string, config: AnimationConfig): CSSStyles {
	let styles: Record<string, string | number> = {
		animationName: name,
		animationDuration: config.duration,
	};
	if (config.easing) styles.animationTimingFunction = config.easing;
	if (config.delay) styles.animationDelay = config.delay;
	if (config.iterationCount !== undefined) styles.animationIterationCount = config.iterationCount;
	if (config.direction) styles.animationDirection = config.direction;
	if (config.fillMode) styles.animationFillMode = config.fillMode;
	if (config.timeline) styles.animationTimeline = config.timeline;
	if (config.range) styles.animationRange = config.range;
	return styles as CSSStyles;
}

function generateName(keyframes: Record<string, CSSStyles>): string {
	return `ui-anim-${hash(JSON.stringify(keyframes))}`;
}

function hash(input: string): string {
	let value = 0;
	for (let index = 0; index < input.length; index++) {
		value = (value * 33) ^ input.charCodeAt(index);
	}
	return (value >>> 0).toString(36);
}
