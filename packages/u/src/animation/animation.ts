/**
 * The primitive animation composer: it emits an `@keyframes` rule and the
 * host `animation-*` declarations that reference it together, in one mixin.
 * It stays at the CSS layer — keyframe emission and declaration composition —
 * leaving named recipes such as fade, slide, or spin to the layers above.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { compose, utility } from "../internal/descriptor";

import { keyframes } from "./keyframes";

/** The keyframes and timing shared by both `animation()` call shapes. */
export interface AnimationConfig {
	keyframes: Record<string, CSSStyles>;
	duration: string;
	easing?: string;
	/** `"150ms"`. The platform default `0s` applies when omitted. */
	delay?: string;
	/** `"infinite"`, `2`. The platform default `1` applies when omitted. */
	iterationCount?: string | number;
	/** `"alternate"`, `"reverse"`. The platform default `"normal"` applies when omitted. */
	direction?: string;
	/** `"both"`, `"forwards"`. The platform default `"none"` applies when omitted. */
	fillMode?: string;
	/** `"scroll()"`, `"view()"`, or a named `--custom-timeline`. The platform default `"auto"` applies when omitted. */
	timeline?: string;
	/** `"entry 0% cover 40%"`. The platform default `"normal"` applies when omitted. */
	range?: string;
}

/**
 * Emits an `@keyframes` rule under `name` together with the host
 * `animation-*` declarations that reference it. Use the named form when the
 * animation name is useful for debugging in devtools.
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
 * Generates a stable name from the keyframe content instead of taking one:
 * identical `keyframes` content always generates the identical name, so
 * one-off animations share a single rule.
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
 * Emits the host `animation-*` declarations alone, taking every
 * {@link AnimationConfig} key but `keyframes`. Pair it with a sibling
 * `u.keyframes` call, since `@keyframes` only hoists from a mixin's top level.
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

/**
 * `iterationCount` is stringified because the CSS serializer appends `px` to a
 * unitless number outside its allow-list, and browsers drop the resulting
 * `animation-iteration-count: 2px`, falling back to a single iteration.
 */
function hostDeclarations(name: string, config: AnimationConfig): CSSStyles {
	let styles: Record<string, string | number> = {
		animationName: name,
		animationDuration: config.duration,
	};
	if (config.easing) styles.animationTimingFunction = config.easing;
	if (config.delay) styles.animationDelay = config.delay;
	if (config.iterationCount !== undefined) {
		styles.animationIterationCount = String(config.iterationCount);
	}
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
