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
const DEFAULT_COLOR: Link.Color = "primary";

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
 * contract and underlined unconditionally, so the link reads as interactive
 * text even where color perception, grayscale rendering, or a
 * `prefers-contrast` override can't be relied on. The underline itself
 * starts as a muted tint of the link's own foreground color and solidifies
 * to the full foreground on hover, and a keyboard focus-visible ring reads
 * in that same semantic color. Set `aria-disabled="true"` to mute a link
 * that shouldn't be followed — the underline lifts and the label dims —
 * keeping in mind that only omitting or neutralizing `href` actually stops
 * the navigation, since a plain anchor has no native disabled state.
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
						outline({ color: "primary.ring", offset: 2 }),
						data("color", "neutral", outline("neutral.ring")),
						data("color", "success", outline("success.ring")),
						data("color", "warning", outline("warning.ring")),
						data("color", "danger", outline("danger.ring")),
					]),
					interactiveTransition(),
					rounded("sm"),
					data("color", "primary", fg("primary")),
					data("color", "neutral", fg("neutral")),
					data("color", "success", fg("success")),
					data("color", "danger", fg("danger")),
					data("color", "warning", fg("warning")),
					when('&[aria-disabled="true"]', opacity(50)),
					textDecoration("underline"),
					cursor("pointer"),
					data("color", "primary", [
						// `color-mix()`'s color argument (`var(--ui-primary-fg)`) isn't
						// a tone string `u.fg()`/`u.color()` can resolve, so the
						// property itself stays raw() — only the literal string
						// becomes a builder call.
						raw({
							textDecorationColor: colorMix(
								"srgb",
								{ color: varUtility("ui-primary-fg"), weight: 60 },
								"transparent",
							),
						}),
						when("&:hover", raw({ textDecorationColor: varUtility("ui-primary-fg") })),
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
