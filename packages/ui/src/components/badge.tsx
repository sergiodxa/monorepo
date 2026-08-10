/**
 * A compact pill communicating a short status, label, or count inline with
 * surrounding content. Its host renders solid, tinted, or outlined depending
 * on a variant attribute, colored through a semantic color role, and
 * composes with `Icon` and `Text` parts for glyph-plus-label badges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border, fg } from "@pkg/u/color";
import { rounded, transition } from "@pkg/u/effects";
import { userSelect } from "@pkg/u/general";
import { gap, inlineFlex, items, shrink } from "@pkg/u/layout";
import { bs, is, pb, pi } from "@pkg/u/size";
import { data, when } from "@pkg/u/state";
import { fontSize, leading, nowrap, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { DEFAULT_ICON_ARIA_HIDDEN } from "../utils/decorative-icon";

/** Semantic color role {@link Badge} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Badge.Color = "neutral";

/** Visual weight {@link Badge} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: Badge.Variant = "default";

/**
 * Prop types for {@link Badge} and its compound parts.
 */
export namespace Badge {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = SemanticColor;

	/**
	 * Visual weight the badge renders with: a solid fill, a tinted fill, or
	 * a transparent chip with just an outline.
	 */
	export type Variant = "default" | "secondary" | "outline";

	/**
	 * Props accepted by {@link Badge}.
	 */
	export interface Props extends TagProps<"span"> {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Visual weight. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
	}

	/**
	 * Props accepted by {@link Badge.Icon}.
	 */
	export interface IconProps extends TagProps<"span"> {}

	/**
	 * Props accepted by {@link Badge.Text}.
	 */
	export interface TextProps extends TagProps<"span"> {}
}

/**
 * Renders a single-line pill host, colored and shaped through the
 * `data-color` and `data-variant` attribute contract: `"default"` fills the
 * pill solid with the color's on-solid foreground, `"secondary"` tints the
 * fill and keeps the color's regular foreground, and `"outline"` renders a
 * transparent chip with just a colored border and foreground. Compose
 * {@link Badge.Icon} and {@link Badge.Text} as children for glyph-plus-label
 * content.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the badge's markup.
 * @example
 * <Badge>{t("badge.new")}</Badge>
 * @example
 * <Badge color="success" variant="secondary">
 * 	<Badge.Icon><CheckIcon /></Badge.Icon>
 * 	<Badge.Text>{t("badge.active")}</Badge.Text>
 * </Badge>
 * @example
 * <Badge color="danger" variant="outline">{t("badge.failed")}</Badge>
 */
export function Badge(handle: Handle<Badge.Props>) {
	return () => {
		let { color, variant, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;

		return (
			<span
				data-color={resolvedColor}
				data-variant={resolvedVariant}
				{...rest}
				mix={[
					inlineFlex(),
					items("center"),
					gap(1),
					rounded("full"),
					border({ width: 1 }),
					pi(2.5),
					pb(0.5),
					leading(1),
					weight("semibold"),
					nowrap(),
					transition(
						"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
					),
					fontSize("xs"),
					userSelect(),
					data("variant", "default", [
						data("color", "brand", [bg("brand.solid"), fg("brand.onSolid"), border("brand.solid")]),
						data("color", "neutral", [
							bg("neutral.solid"),
							fg("neutral.onSolid"),
							border("neutral.solid"),
						]),
						data("color", "success", [
							bg("success.solid"),
							fg("success.onSolid"),
							border("success.solid"),
						]),
						data("color", "warning", [
							bg("warning.solid"),
							fg("warning.onSolid"),
							border("warning.solid"),
						]),
						data("color", "danger", [
							bg("danger.solid"),
							fg("danger.onSolid"),
							border("danger.solid"),
						]),
					]),
					data("variant", "secondary", [
						data("color", "brand", [bg("brand.tint"), fg("brand"), border("brand")]),
						data("color", "neutral", [bg("neutral.tint"), fg("neutral"), border("neutral")]),
						data("color", "success", [bg("success.tint"), fg("success"), border("success")]),
						data("color", "warning", [bg("warning.tint"), fg("warning"), border("warning")]),
						data("color", "danger", [bg("danger.tint"), fg("danger"), border("danger")]),
					]),
					data("variant", "outline", [
						bg("transparent"),
						data("color", "brand", [border("brand.strong"), fg("brand")]),
						data("color", "neutral", [border("neutral"), fg("neutral")]),
						data("color", "success", [border("success.strong"), fg("success")]),
						data("color", "warning", [border("warning.strong"), fg("warning")]),
						data("color", "danger", [border("danger.strong"), fg("danger")]),
					]),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders the badge's leading or trailing glyph slot: an inert, shrink-proof
 * `<span>` sized to hold a single small icon, hidden from assistive
 * technology by default since the badge's meaning is carried by
 * {@link Badge.Text} instead.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the icon slot's markup.
 * @example
 * <Badge.Icon><CheckIcon /></Badge.Icon>
 */
Badge.Icon = function BadgeIcon(handle: Handle<Badge.IconProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<span
				{...rest}
				mix={[
					attrs({ "aria-hidden": DEFAULT_ICON_ARIA_HIDDEN }),
					inlineFlex(),
					shrink(0),
					when("& > svg", [is(3), bs(3), shrink(0), fg("currentColor")]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the badge's label slot: a `<span>` with its line height collapsed
 * to one, keeping short label text vertically centered inside the pill.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the label slot's markup.
 * @example
 * <Badge.Text>{t("badge.active")}</Badge.Text>
 */
Badge.Text = function BadgeText(handle: Handle<Badge.TextProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <span {...rest} mix={[leading(1), mix]} />;
	};
};
