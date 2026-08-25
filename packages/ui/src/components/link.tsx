/**
 * A native anchor for inline navigation, always underlined so its
 * affordance never rests on color alone, and colored through a semantic
 * color role that also drives its focus ring and disabled state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { colorMix, fg, outline } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor, raw, var as varUtility } from "@pkg/u/general";
import { data, when } from "@pkg/u/state";
import { textDecoration } from "@pkg/u/typography";

import type { SemanticColor } from "../utils/semantic-color";

import { interactiveTransition } from "../styles/interactive-transition";

/** Semantic color role {@link Link} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Link.Color = "brand";

/**
 * Prop types for {@link Link}.
 */
export namespace Link {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = SemanticColor;

	/**
	 * Props accepted by {@link Link}. A type alias rather than an interface,
	 * since the native anchor props resolve through a conditional type that an
	 * `interface extends` clause can't statically extend.
	 */
	export type Props = TagProps<"a"> & {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
	};
}

/**
 * Renders a native `<a>` host, colored through the `data-color` attribute
 * contract and underlined unconditionally. `aria-disabled="true"` mutes the
 * link, but only removing or neutralizing `href` actually stops navigation.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the link's markup.
 * @example
 * <Link href="/about">{t("nav.about")}</Link>
 * @example
 * <Link href="/delete" color="danger">{t("actions.delete")}</Link>
 * @example
 * <Link href="/settings" aria-disabled="true">{t("nav.settings")}</Link>
 */
export function Link(handle: Handle<Link.Props>) {
	return () => {
		let { color, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		return (
			<a
				data-color={resolvedColor}
				{...rest}
				mix={[
					when("&:focus-visible", [
						outline({ color: "brand.ring", offset: 2 }),
						data("color", "neutral", outline("neutral.ring")),
						data("color", "success", outline("success.ring")),
						data("color", "warning", outline("warning.ring")),
						data("color", "danger", outline("danger.ring")),
					]),
					interactiveTransition(),
					rounded("sm"),
					data("color", "brand", fg("brand")),
					data("color", "neutral", fg("neutral")),
					data("color", "success", fg("success")),
					data("color", "danger", fg("danger")),
					data("color", "warning", fg("warning")),
					when('&[aria-disabled="true"]', opacity(50)),
					textDecoration("underline"),
					cursor("pointer"),
					data("color", "brand", [
						/**
						 * `color-mix()`'s color argument needs the raw CSS variable
						 * (`var(--ui-brand-fg)`), so the property stays `raw()` while
						 * the literal string becomes a builder call.
						 */
						raw({
							textDecorationColor: colorMix(
								"srgb",
								{ color: varUtility("ui-brand-fg"), weight: 60 },
								"transparent",
							),
						}),
						when("&:hover", raw({ textDecorationColor: varUtility("ui-brand-fg") })),
					]),
					data("color", "neutral", [
						raw({
							textDecorationColor: colorMix(
								"srgb",
								{ color: varUtility("ui-neutral-fg"), weight: 50 },
								"transparent",
							),
						}),
						when("&:hover", raw({ textDecorationColor: varUtility("ui-neutral-fg") })),
					]),
					data("color", "success", [
						raw({
							textDecorationColor: colorMix(
								"srgb",
								{ color: varUtility("ui-success-fg"), weight: 60 },
								"transparent",
							),
						}),
						when("&:hover", raw({ textDecorationColor: varUtility("ui-success-fg") })),
					]),
					data("color", "danger", [
						raw({
							textDecorationColor: colorMix(
								"srgb",
								{ color: varUtility("ui-danger-fg"), weight: 60 },
								"transparent",
							),
						}),
						when("&:hover", raw({ textDecorationColor: varUtility("ui-danger-fg") })),
					]),
					data("color", "warning", [
						raw({
							textDecorationColor: colorMix(
								"srgb",
								{ color: varUtility("ui-warning-fg"), weight: 60 },
								"transparent",
							),
						}),
						when("&:hover", raw({ textDecorationColor: varUtility("ui-warning-fg") })),
					]),
					when('&[aria-disabled="true"]', [cursor("not-allowed"), textDecoration("none")]),
					mix,
				]}
			/>
		);
	};
}
