/**
 * The glass the search dialog's surfaces are cut from, and how they move: the box's pill and
 * the card under it float apart over the page, each a frosted panel with a hairline edge,
 * settling into place as the dialog opens and falling back as it closes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, colorMix, fg } from "@sdxc/u/color";
import {
	backdropBlur,
	backdropSaturate,
	opacity,
	shadow,
	transition,
	transitionDelay,
	transitionDuration,
	transitionProperty,
} from "@sdxc/u/effects";
import { dark, light, media, startingStyle } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { scaleProperty, translateProperty } from "@sdxc/u/transform";
import { durations, easings } from "@sdxc/ui/animations";

import { SEARCH_FOLLOW_ATTRIBUTE } from "~/resources/components/search-box";

/** How long the dialog stays on screen after closing, while its surfaces fall back. */
export const SEARCH_EXIT_MS: number = durations.fast;

/**
 * The panel's own text color at low strength: a hairline that stays equally faint against
 * the panel in light and dark themes.
 */
export const SEARCH_HAIRLINE = colorMix(
	"oklab",
	{ color: "var(--ui-neutral-fg-emphasis)", weight: 10 },
	"transparent",
);

/**
 * A frosted panel, lighter in the light theme where the page behind is pale enough to show
 * through. A reader who asks for reduced transparency gets the solid panel color instead.
 */
export function searchSurface() {
	return [
		bg("neutral.tint"),
		fg("neutral.emphasis"),
		border({ color: SEARCH_HAIRLINE, width: 1 }),
		shadow("xl"),
		media("(prefers-reduced-transparency: no-preference)", [
			light(
				bg(colorMix("oklab", { color: "var(--ui-neutral-bg-tint)", weight: 62 }, "transparent")),
			),
			dark(
				bg(colorMix("oklab", { color: "var(--ui-neutral-bg-tint)", weight: 88 }, "transparent")),
			),
			backdropBlur("xl"),
			backdropSaturate(1.8),
		]),
	];
}

/**
 * Moves a surface toward the reader as the dialog opens, after `enterDelay` milliseconds, and
 * away at once as it is dismissed; following a link lifts it on toward the reader instead, so
 * leaving through a result reads apart from closing. Under reduced motion only opacity changes.
 *
 * @param enterDelay How long the surface waits after the dialog opens.
 */
export function searchSurfaceMotion(enterDelay = 0) {
	return [
		transition("opacity, scale, translate, visibility", {
			duration: durations.normal,
			easing: easings.decelerate,
		}),
		when(
			`:is(dialog[open]:not([${SEARCH_FOLLOW_ATTRIBUTE}])) &`,
			transitionDelay(`${enterDelay}ms`),
		),
		startingStyle(
			when(":is(dialog[open]) &", [
				opacity(0),
				scaleProperty(0.98),
				translateProperty("0 -0.5rem"),
			]),
		),
		when(":is(dialog:not([open])) &", [
			opacity(0),
			scaleProperty(0.96),
			transitionDuration(`${SEARCH_EXIT_MS}ms`),
		]),
		when(`:is(dialog[${SEARCH_FOLLOW_ATTRIBUTE}]) &`, [
			opacity(0),
			scaleProperty(1.03),
			transitionDuration(`${durations.normal}ms`),
		]),
		media("(prefers-reduced-motion: reduce)", transitionProperty("opacity, visibility")),
	];
}
