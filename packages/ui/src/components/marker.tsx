/**
 * An inline row calling out a small event between two message rows — a
 * delivery status, a system note, a highlighted callout, or a labeled
 * divider — colored by a semantic tone and shaped by a variant.
 * {@link Marker.Icon} and {@link Marker.Content} compose beneath it for a
 * glyph-plus-caption row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { pseudoContent } from "@sdxc/u/general";
import { basis, center, gap, grow, inlineFlex, items, shrink } from "@sdxc/u/layout";
import { bs, is, minIs, pb, pi } from "@sdxc/u/size";
import { data, when } from "@sdxc/u/state";
import { fontSize, leading, weight } from "@sdxc/u/typography";
import { attrs } from "remix/ui";

/** Visual shape {@link Marker} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: Marker.Variant = "default";

/** Semantic color role {@link Marker} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Marker.Color = "neutral";

/**
 * Default `aria-hidden` applied to {@link Marker.Icon} through
 * {@link attrs}, keeping a decorative glyph out of the accessibility tree
 * unless a consumer overrides it for a control with its own name and role.
 */
const DEFAULT_ICON_ARIA_HIDDEN = "true";

/**
 * `role` applied through {@link attrs} when `variant` is `"separator"`,
 * matching the accessibility contract a divider between groups of content
 * carries regardless of whether it's drawn as a bare line or a labeled one.
 */
const DEFAULT_SEPARATOR_ROLE = "separator";

/**
 * `aria-orientation` applied through {@link attrs} alongside
 * {@link DEFAULT_SEPARATOR_ROLE}, since a labeled separator between message
 * rows always reads as a horizontal divider.
 */
const DEFAULT_SEPARATOR_ORIENTATION = "horizontal";

/**
 * Prop types for {@link Marker} and its compound parts.
 */
export namespace Marker {
	/**
	 * Visual shape the row renders with: `"default"` for a plain, centered
	 * caption, `"border"` for a bordered, tinted callout panel, and
	 * `"separator"` for a caption flanked by a hairline divider on either side.
	 */
	export type Variant = "default" | "border" | "separator";

	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Props accepted by {@link Marker}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Visual shape of the row. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** The row's compound parts: {@link Marker.Icon} followed by {@link Marker.Content}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Marker.Icon}.
	 */
	export interface IconProps extends TagProps<"span"> {
		/** The icon graphic, typically a single SVG icon, or a nested control such as {@link Spinner}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Marker.Content}.
	 */
	export interface ContentProps extends TagProps<"span"> {
		/** The row's caption text. */
		children: RemixNode;
	}
}

/**
 * Renders the row's host element: a centered flex line framed through the
 * `data-variant` and `data-color` attributes, with `variant="separator"`
 * also picking up `role="separator"`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Marker color="success">
 * 	<Marker.Icon><CheckIcon /></Marker.Icon>
 * 	<Marker.Content>{t("marker.delivered")}</Marker.Content>
 * </Marker>
 * @example
 * <Marker>
 * 	<Marker.Content>{t("marker.userJoined", { name: user.name })}</Marker.Content>
 * </Marker>
 * @example
 * <Marker variant="border" color="warning">
 * 	<Marker.Icon><TriangleAlertIcon /></Marker.Icon>
 * 	<Marker.Content>{t("marker.reconnecting")}</Marker.Content>
 * </Marker>
 * @example
 * <Marker variant="separator">
 * 	<Marker.Content>{t("marker.today")}</Marker.Content>
 * </Marker>
 */
export function Marker(handle: Handle<Marker.Props>) {
	return () => {
		let { variant, color, children, mix, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedColor = color ?? DEFAULT_COLOR;

		return (
			<div
				data-variant={resolvedVariant}
				data-color={resolvedColor}
				{...rest}
				mix={[
					resolvedVariant === "separator"
						? attrs({
								role: DEFAULT_SEPARATOR_ROLE,
								"aria-orientation": DEFAULT_SEPARATOR_ORIENTATION,
							})
						: undefined,
					center(),
					is("full"),
					weight("medium"),
					data("color", "brand", fg("brand.muted")),
					data("color", "neutral", fg("neutral.muted")),
					data("color", "success", fg("success.muted")),
					data("color", "warning", fg("warning.muted")),
					data("color", "danger", fg("danger.muted")),
					data("variant", "border", [
						rounded("md"),
						border({ width: 1 }),
						pb(2),
						pi(3.5),
						data("color", "brand", [border("brand"), bg("brand.tint"), fg("brand.emphasis")]),
						data("color", "neutral", [
							border("neutral"),
							bg("neutral.tint"),
							fg("neutral.emphasis"),
						]),
						data("color", "success", [
							border("success"),
							bg("success.tint"),
							fg("success.emphasis"),
						]),
						data("color", "warning", [
							border("warning"),
							bg("warning.tint"),
							fg("warning.emphasis"),
						]),
						data("color", "danger", [border("danger"), bg("danger.tint"), fg("danger.emphasis")]),
					]),
					gap("var(--ui-marker-gap, 0.375rem)"),
					pb("0.375rem"),
					fontSize("0.8125rem"),
					leading("calc(1.25 / 0.8125)"),
					data(
						"variant",
						"separator",
						when("&::before, &::after", [
							pseudoContent('""'),
							grow(),
							shrink(1),
							basis("0%"),
							minIs("1.5rem"),
							bs("var(--ui-separator-thickness, 1px)"),
							bg("neutral.border"),
						]),
					),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders {@link Marker.IconProps.children} as the row's glyph slot,
 * hidden from assistive technology unless a consumer overrides it for a
 * nested accessible control like {@link Spinner}.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the icon slot's markup.
 * @example
 * <Marker.Icon><CheckIcon /></Marker.Icon>
 * @example
 * <Marker.Icon aria-hidden={false}>
 * 	<Spinner size="sm" aria-label={t("status.generating")} />
 * </Marker.Icon>
 */
Marker.Icon = function MarkerIcon(handle: Handle<Marker.IconProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<span
				{...rest}
				mix={[
					attrs({ "aria-hidden": DEFAULT_ICON_ARIA_HIDDEN }),
					inlineFlex(),
					shrink(),
					items("center"),
					fg("currentcolor"),
					when("& > svg", [is("1em"), bs("1em")]),
					mix,
				]}
			>
				{children}
			</span>
		);
	};
};

/**
 * Renders {@link Marker.ContentProps.children} as the row's caption: a
 * `<span>` inheriting its color, size, and weight from the {@link Marker}
 * root so a single `data-color` drives the icon and caption together.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the caption's markup.
 * @example
 * <Marker.Content>{t("marker.today")}</Marker.Content>
 * @example
 * <Marker.Content mix={[textShimmer()]}>{t("chat.generating")}</Marker.Content>
 */
Marker.Content = function MarkerContent(handle: Handle<Marker.ContentProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <span {...rest} mix={[minIs(0), mix]} />;
	};
};
