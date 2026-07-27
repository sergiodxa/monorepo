/**
 * An inline row calling out a small event between two message rows — a
 * delivery status, a system note, a highlighted callout, or a labeled
 * divider — colored by a semantic tone and shaped by a variant rather than
 * a wall of nested parts. {@link Marker.Icon} and {@link Marker.Content}
 * compose beneath it for a glyph-plus-caption row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { pseudoContent, raw } from "@pkg/u/general";
import { basis, center, gap, grow, inlineFlex, items, shrink } from "@pkg/u/layout";
import { bs, is, minIs, pb, pi } from "@pkg/u/size";
import { data, when } from "@pkg/u/state";
import { weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

/** Visual shape {@link Marker} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: Marker.Variant = "default";

/** Semantic color role {@link Marker} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Marker.Color = "neutral";

/**
 * Default `aria-hidden` value applied to {@link Marker.Icon} through
 * {@link attrs} unless a consumer overrides it, keeping a purely decorative
 * glyph out of the accessibility tree. A consumer nesting a control that
 * carries its own accessible name and role — {@link Marker.Icon}'s own JSDoc
 * covers the progress-marker case — overrides this to `aria-hidden={false}`
 * so that control still reaches assistive technology.
 */
const DEFAULT_ICON_ARIA_HIDDEN = true;

/**
 * `role` applied through {@link attrs} when `variant` is `"separator"`,
 * matching the accessibility contract a divider between groups of content
 * carries regardless of whether it's drawn as a bare line or a labeled one.
 */
const DEFAULT_SEPARATOR_ROLE = "separator";

/**
 * `aria-orientation` applied through {@link attrs} alongside
 * {@link DEFAULT_SEPARATOR_ROLE}. A labeled separator between message rows
 * always reads as a horizontal divider, so no vertical variant is exposed.
 */
const DEFAULT_SEPARATOR_ORIENTATION = "horizontal";

/**
 * Prop types for {@link Marker} and its compound parts.
 */
export namespace Marker {
	/**
	 * Visual shape the row renders with: `"default"` is a plain, centered
	 * caption suited to an inline status update or a system note; `"border"`
	 * frames the row in a bordered, tinted panel for a callout that deserves
	 * more visual weight; `"separator"` flanks the caption with a hairline on
	 * either side, reading as a labeled divider between groups of message
	 * rows.
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
 * Renders the row's host element: a centered flex line whose framing comes
 * entirely from the `data-variant` and `data-color` attribute contract.
 * `variant="separator"` also renders a hairline on either side of the row's
 * content through `::before`/`::after`, and picks up `role="separator"` plus
 * `aria-orientation="horizontal"` by default so it reads as a divider
 * between groups of content even though it carries a label. `variant`
 * defaults to a plain, unframed row and `color` defaults to the neutral
 * tone; compose {@link Marker.Icon} and {@link Marker.Content} inside it.
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
					raw({ fontSize: "0.8125rem", lineHeight: "calc(1.25 / 0.8125)" }),
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
 * Renders {@link Marker.IconProps.children} as the row's leading glyph slot:
 * an inline-flex, shrink-proof `<span>` sizing any direct SVG child to a
 * single em box so it scales with {@link Marker.Content}'s font size, tinted
 * by the current text color inherited from the {@link Marker} root. Hidden
 * from assistive technology by default since a decorative glyph's meaning is
 * already carried by {@link Marker.Content}'s caption.
 *
 * Composing a control that carries its own accessible name and role instead
 * of a decorative glyph — {@link Spinner}, for a progress marker — calls for
 * overriding the default: set `aria-hidden={false}` so the nested control's
 * own role and label reach assistive technology instead of being hidden
 * along with the rest of the slot.
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
 * `<span>` carrying no color, size, or weight of its own beyond what it
 * inherits from the {@link Marker} root, so a single `data-color` on the
 * root drives the icon and the caption together. A streaming caption —
 * "Generating response…" while a reply is still arriving — composes the
 * `textShimmer()` animation from the animation layer through `mix` for its
 * sweeping highlight; the caption renders as plain, fully readable text on
 * its own, the sweep is additive.
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
