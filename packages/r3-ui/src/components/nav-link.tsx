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

import { css } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

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
					css({
						borderRadius: "var(--ui-radius-sm, 0.25rem)",
						cursor: "pointer",
						textDecorationLine: "underline",
						textDecorationColor: "color-mix(in oklab, currentcolor 60%, transparent)",
						textUnderlineOffset: "4px",

						"&:hover": {
							textDecorationColor: "currentcolor",
						},

						'&[data-color="primary"]': {
							color: "var(--ui-primary-fg)",
							'&[aria-current]:not([aria-current="false"])': {
								fontWeight: "500",
								color: "var(--ui-primary-fg-emphasis)",
							},
						},
						'&[data-color="neutral"]': {
							color: "var(--ui-neutral-fg)",
							'&[aria-current]:not([aria-current="false"])': {
								fontWeight: "500",
								color: "var(--ui-neutral-fg-emphasis)",
							},
						},
						'&[data-color="success"]': {
							color: "var(--ui-success-fg)",
							'&[aria-current]:not([aria-current="false"])': {
								fontWeight: "500",
								color: "var(--ui-success-fg-emphasis)",
							},
						},
						'&[data-color="warning"]': {
							color: "var(--ui-warning-fg)",
							'&[aria-current]:not([aria-current="false"])': {
								fontWeight: "500",
								color: "var(--ui-warning-fg-emphasis)",
							},
						},
						'&[data-color="danger"]': {
							color: "var(--ui-danger-fg)",
							'&[aria-current]:not([aria-current="false"])': {
								fontWeight: "500",
								color: "var(--ui-danger-fg-emphasis)",
							},
						},

						'&[aria-current]:not([aria-current="false"])': {
							fontWeight: "500",
							textDecorationThickness: "2px",
							textDecorationColor: "currentcolor",
						},

						"&[data-has-background]": {
							textDecorationLine: "none",
						},
						'&[data-has-background]:hover, &[data-has-background][aria-current]:not([aria-current="false"])':
							{
								textDecorationLine: "none",
							},

						"&:focus-visible": {
							outlineWidth: "2px",
							outlineStyle: "solid",
							outlineOffset: "2px",
							outlineColor: "var(--ui-primary-ring)",
						},
					}),
					mix,
				]}
			/>
		);
	};
}
