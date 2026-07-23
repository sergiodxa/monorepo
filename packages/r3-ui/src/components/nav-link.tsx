/**
 * An inline text link for site navigation, colored through a semantic color
 * role and underlined to read as a link among surrounding prose. Its current
 * or visited-section state comes straight from `aria-current` set on the
 * host, rendering the emphasized, non-underlined current-page treatment with
 * no script tracking a route on the client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { cursor, raw } from "@pkg/u/general";
import { when } from "@pkg/u/state";
import { weight } from "@pkg/u/typography";
import { css } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { focusRingPrimary } from "../styles/focus-ring";
import { interactiveTransition } from "../styles/interactive-transition";

/** Semantic color role {@link NavLink} falls back to when `color` is omitted. */
const DEFAULT_COLOR: NavLink.Color = "neutral";

/**
 * Prop types for {@link NavLink}.
 */
export namespace NavLink {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = SemanticColor;

	/**
	 * Props accepted by {@link NavLink}. Built as an intersection rather than
	 * an interface extension because the underlying anchor prop type is a
	 * union keyed on `href` (the accessible-anchor contract restricts `role`
	 * once `href` is present), which an `interface … extends` clause cannot
	 * carry.
	 */
	export type Props = TagProps<"a"> & {
		/** Destination the link navigates to. */
		href: string;
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/**
		 * Marks the link as living over a colored background rather than bare
		 * prose: drops the underline entirely, since a background fill already
		 * separates it visually from surrounding text and an always-on
		 * underline would compete with that treatment.
		 */
		hasBackground?: boolean;
	};
}

/**
 * Renders a native `<a>` host, colored through the `data-color` attribute
 * contract and underlined with a translucent decoration that solidifies on
 * `:hover`. The link's current-page state reads directly off `aria-current`
 * — set `aria-current="page"` (or any value other than `"false"`) on the
 * host from whatever routing layer determines the active path server-side,
 * and the link renders with heavier weight, its emphasis foreground color,
 * and a thicker, fully opaque underline. Setting `hasBackground` removes the
 * underline in every state, for a link meant to sit over its own filled
 * background instead of inline with text. A keyboard focus-visible ring
 * reads in the primary color regardless of the link's own `color`.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the link's markup.
 * @example
 * <NavLink href="/dashboard" color="primary">{t("nav.dashboard")}</NavLink>
 * @example
 * <NavLink href="/settings" aria-current={pathname === "/settings" ? "page" : undefined}>{t("nav.settings")}</NavLink>
 * @example
 * <NavLink href="/settings" hasBackground mix={css({ paddingInline: "0.75rem", paddingBlock: "0.5rem" })}>{t("nav.settings")}</NavLink>
 */
export function NavLink(handle: Handle<NavLink.Props>) {
	return () => {
		let { color, hasBackground, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		return (
			<a
				{...rest}
				data-color={resolvedColor}
				data-has-background={hasBackground || undefined}
				mix={[
					interactiveTransition(),
					rounded("sm"),
					focusRingPrimary(),
					cursor("pointer"),
					css({
						textDecorationLine: "underline",
						textDecorationColor: "color-mix(in oklab, currentcolor 60%, transparent)",
						textUnderlineOffset: "4px",

						"&:hover": {
							textDecorationColor: "currentcolor",
						},
					}),
					when('&[data-color="primary"]', [
						fg("primary"),
						when('&[aria-current]:not([aria-current="false"])', [
							weight(500),
							fg("primary.emphasis"),
						]),
					]),
					when('&[data-color="neutral"]', [
						fg("neutral"),
						when('&[aria-current]:not([aria-current="false"])', [
							weight(500),
							fg("neutral.emphasis"),
						]),
					]),
					when('&[data-color="success"]', [
						fg("success"),
						when('&[aria-current]:not([aria-current="false"])', [
							weight(500),
							fg("success.emphasis"),
						]),
					]),
					when('&[data-color="warning"]', [
						fg("warning"),
						when('&[aria-current]:not([aria-current="false"])', [
							weight(500),
							fg("warning.emphasis"),
						]),
					]),
					when('&[data-color="danger"]', [
						fg("danger"),
						when('&[aria-current]:not([aria-current="false"])', [
							weight(500),
							fg("danger.emphasis"),
						]),
					]),
					when('&[aria-current]:not([aria-current="false"])', [
						weight(500),
						raw({ textDecorationThickness: "2px", textDecorationColor: "currentcolor" }),
					]),
					when("&[data-has-background]", raw({ textDecorationLine: "none" })),
					when(
						'&[data-has-background]:hover, &[data-has-background][aria-current]:not([aria-current="false"])',
						raw({ textDecorationLine: "none" }),
					),
					mix,
				]}
			/>
		);
	};
}
