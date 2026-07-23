/**
 * A native anchor for inline navigation, always underlined so its
 * affordance never rests on color alone, and colored through a semantic
 * color role that also drives its focus ring and disabled state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { when } from "@pkg/u/state";
import { css } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { focusRingByColor } from "../styles/focus-ring";
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
					focusRingByColor(),
					interactiveTransition(),
					rounded("sm"),
					when('&[data-color="primary"]', fg("primary")),
					when('&[data-color="neutral"]', fg("neutral")),
					when('&[data-color="success"]', fg("success")),
					when('&[data-color="danger"]', fg("danger")),
					when('&[data-color="warning"]', fg("warning")),
					when('&[aria-disabled="true"]', opacity(50)),
					css({
						textDecoration: "underline",
						cursor: "pointer",

						'&[data-color="primary"]': {
							textDecorationColor: "color-mix(in srgb, var(--ui-primary-fg) 60%, transparent)",
							"&:hover": { textDecorationColor: "var(--ui-primary-fg)" },
						},
						'&[data-color="neutral"]': {
							textDecorationColor: "color-mix(in srgb, var(--ui-neutral-fg) 50%, transparent)",
							"&:hover": { textDecorationColor: "var(--ui-neutral-fg)" },
						},
						'&[data-color="success"]': {
							textDecorationColor: "color-mix(in srgb, var(--ui-success-fg) 60%, transparent)",
							"&:hover": { textDecorationColor: "var(--ui-success-fg)" },
						},
						'&[data-color="danger"]': {
							textDecorationColor: "color-mix(in srgb, var(--ui-danger-fg) 60%, transparent)",
							"&:hover": { textDecorationColor: "var(--ui-danger-fg)" },
						},
						'&[data-color="warning"]': {
							textDecorationColor: "color-mix(in srgb, var(--ui-warning-fg) 60%, transparent)",
							"&:hover": { textDecorationColor: "var(--ui-warning-fg)" },
						},

						'&[aria-disabled="true"]': {
							cursor: "not-allowed",
							textDecoration: "none",
						},
					}),
					mix,
				]}
			/>
		);
	};
}
