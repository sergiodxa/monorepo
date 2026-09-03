/**
 * An inline text link for site navigation, colored through a semantic color
 * role and underlined to read as a link among surrounding prose. Its
 * current-page state comes straight from `aria-current` set on the host
 * server-side, rendering the emphasized, non-underlined treatment directly
 * from that attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { colorMix, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { data, hover, when } from "@sdxc/u/state";
import { textDecoration, weight } from "@sdxc/u/typography";

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
	 * Props accepted by {@link NavLink}, built as an intersection: the
	 * underlying anchor prop type is a union keyed on `href`, since the
	 * accessible-anchor contract restricts `role` once `href` is present.
	 */
	export type Props = TagProps<"a"> & {
		/** Destination the link navigates to. */
		href: string;
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/**
		 * Marks the link as sitting over its own colored background: drops the
		 * underline entirely, since the background fill already sets it apart
		 * from surrounding text.
		 */
		hasBackground?: boolean;
	};
}

/**
 * Renders a native `<a>`, colored via `data-color` and underlined with a
 * translucent decoration that solidifies on hover. Setting `aria-current`
 * server-side renders the current-page treatment; the focus-visible ring always reads in the primary color.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the link's markup.
 * @example
 * <NavLink href="/dashboard" color="brand">{t("nav.dashboard")}</NavLink>
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
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					cursor("pointer"),
					textDecoration("underline"),
					raw({
						textDecorationColor: colorMix(
							"oklab",
							{ color: "currentcolor", weight: 60 },
							"transparent",
						),
						textUnderlineOffset: "4px",
					}),
					hover(raw({ textDecorationColor: "currentcolor" })),
					data("color", "brand", [
						fg("brand"),
						when('&[aria-current]:not([aria-current="false"])', [
							weight(500),
							fg("brand.emphasis"),
						]),
					]),
					data("color", "neutral", [
						fg("neutral"),
						when('&[aria-current]:not([aria-current="false"])', [
							weight(500),
							fg("neutral.emphasis"),
						]),
					]),
					data("color", "success", [
						fg("success"),
						when('&[aria-current]:not([aria-current="false"])', [
							weight(500),
							fg("success.emphasis"),
						]),
					]),
					data("color", "warning", [
						fg("warning"),
						when('&[aria-current]:not([aria-current="false"])', [
							weight(500),
							fg("warning.emphasis"),
						]),
					]),
					data("color", "danger", [
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
					data("has-background", textDecoration("none")),
					when(
						'&[data-has-background]:hover, &[data-has-background][aria-current]:not([aria-current="false"])',
						textDecoration("none"),
					),
					mix,
				]}
			/>
		);
	};
}
