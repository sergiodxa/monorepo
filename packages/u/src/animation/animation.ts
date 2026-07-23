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
 * The keyframes, duration, and optional easing/iteration/direction/fill-mode
 * shared by both `animation()` call shapes.
 */
export interface AnimationConfig {
	keyframes: Record<string, CSSStyles>;
	duration: string;
	easing?: string;
	/** Sets `animationIterationCount` (e.g. `"infinite"`, `2`). Omitted (platform default `1`) when not given. */
	iterationCount?: string | number;
	/** Sets `animationDirection` (e.g. `"alternate"`, `"reverse"`). Omitted (platform default `"normal"`) when not given. */
	direction?: string;
	/** Sets `animationFillMode` (e.g. `"both"`, `"forwards"`). Omitted (platform default `"none"`) when not given. */
	fillMode?: string;
}

/**
 * Emits an `@keyframes` rule under `name` plus host `animationName`,
 * `animationDuration`, and (when given) `animationTimingFunction`,
 * `animationIterationCount`, `animationDirection`, and `animationFillMode`
 * declarations that reference it. Use the named form when the animation
 * name is useful for debugging in devtools.
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

function hostDeclarations(name: string, config: AnimationConfig): CSSStyles {
	let styles: Record<string, string | number> = {
		animationName: name,
		animationDuration: config.duration,
	};
	if (config.easing) styles.animationTimingFunction = config.easing;
	if (config.iterationCount !== undefined) styles.animationIterationCount = config.iterationCount;
	if (config.direction) styles.animationDirection = config.direction;
	if (config.fillMode) styles.animationFillMode = config.fillMode;
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
