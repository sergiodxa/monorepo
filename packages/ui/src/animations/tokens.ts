/**
 * Shared motion vocabulary for the animation layer: named transition-duration
 * steps and named `transition-timing-function` curves. Every factory in
 * `transitions.ts` defaults to one of these instead of an arbitrary number,
 * so overlays across the whole catalog settle into the same rhythm.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Named `transition-timing-function` curves shared by every animation
 * factory, component, and mixin that needs one, so every transition across
 * the catalog settles into the same small set of curves instead of each
 * caller typing its own `cubic-bezier(...)` value or `"linear"` keyword.
 *
 * @example
 * fade({ easing: easings.decelerate });
 * @example
 * transitionTimingFunction: easings.standard,
 */
export const easings = {
	/** The general-purpose curve for enter/exit transitions: gentle acceleration, gentle deceleration. */
	standard: "cubic-bezier(0.4, 0, 0.2, 1)",
	/** Starts fast and settles slowly; reads as an element arriving into place. Suits entrances. */
	decelerate: "cubic-bezier(0, 0, 0.2, 1)",
	/** Starts slowly and leaves quickly; reads as an element departing the screen. Suits exits. */
	accelerate: "cubic-bezier(0.4, 0, 1, 1)",
	/** No asymmetry between start and end; matches the platform's own `linear` keyword. */
	linear: "linear",
} as const;

/**
 * Named `transition-duration` steps, in milliseconds, ordered from the
 * snappiest anchored surface to the largest edge-docked one. Pass one of
 * these as an animation factory's `duration` option instead of an arbitrary
 * number, so every overlay in an app settles on the same rhythm.
 *
 * @example
 * fade({ duration: durations.fast });
 */
export const durations = {
	/** Small surfaces anchored to a trigger: Tooltip, HoverCard, Menu. */
	fast: 150,
	/** The default for most overlays: Popover, Dialog, Toast. */
	normal: 200,
	/** Larger surfaces that cover more of the viewport: Sheet, Drawer. */
	slow: 300,
	/** The largest surfaces, or a transition carrying secondary motion alongside the primary one. */
	slower: 400,
} as const;
