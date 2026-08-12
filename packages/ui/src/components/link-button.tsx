/**
 * A navigation action styled to read as a button rather than inline text —
 * "View project", "Download", a dialog's "Cancel" that also navigates away.
 * Its host renders as a native `<a>`, sharing {@link Button}'s semantic
 * color role, visual weight variant, and size so a link and a button placed
 * side by side render pixel-identical.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border, fg, outline } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor, pointerEvents, userSelect } from "@pkg/u/general";
import { gap, inlineFlex, items, justify, shrink } from "@pkg/u/layout";
import { pb, pi } from "@pkg/u/size";
import { active, data, hover, when } from "@pkg/u/state";
import { text, weight } from "@pkg/u/typography";

import type { SemanticColor } from "../utils/semantic-color";

import { interactiveTransition } from "../styles/interactive-transition";

/** Semantic color role {@link LinkButton} falls back to when `color` is omitted. */
const DEFAULT_COLOR: LinkButton.Color = "neutral";

/** Visual weight {@link LinkButton} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: LinkButton.Variant = "solid";

/** Size variant {@link LinkButton} falls back to when `size` is omitted. */
const DEFAULT_SIZE: LinkButton.Size = "md";

/**
 * Prop types for {@link LinkButton}.
 */
export namespace LinkButton {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = SemanticColor;

	/**
	 * Visual weight the link renders with: a solid fill with an on-solid
	 * foreground, a transparent fill with a strong colored border, or a fully
	 * transparent fill with just a colored label.
	 */
	export type Variant = "solid" | "outline" | "ghost";

	/**
	 * Size variant controlling the link's padding and font size.
	 */
	export type Size = "sm" | "md" | "lg";

	/**
	 * Props accepted by {@link LinkButton}. A type alias rather than an
	 * interface, since the native anchor props resolve to an intersection
	 * type that TypeScript can't use in an `extends` clause.
	 */
	export type Props = TagProps<"a"> & {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Visual weight. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
	};
}

/**
 * Renders a native `<a>` host, colored and shaped through the same
 * `data-color`, `data-variant`, and `data-size` attribute contract as
 * {@link Button}: `"solid"` fills the link with the color's solid background
 * and on-solid foreground, `"outline"` renders a strong colored border over a
 * transparent fill, and `"ghost"` renders just the colored label over a
 * transparent fill until hovered. Hover and active states ride the native
 * `:hover` and `:active` pseudo-classes, and a keyboard focus-visible ring
 * reads in the link's own semantic color.
 *
 * The host has no native disabled state — set `aria-disabled="true"` directly
 * on it to render the dimmed treatment and block pointer clicks and hover.
 * `aria-disabled` doesn't remove the host from tab order or stop keyboard
 * activation on its own, so also drop `href` at the markup level for a link
 * that must be fully inert.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the link's markup.
 * @example
 * <LinkButton href="/projects/new">{t("actions.createProject")}</LinkButton>
 * @example
 * <LinkButton href="/projects" color="neutral" variant="outline" size="sm">{t("actions.cancel")}</LinkButton>
 * @example
 * <LinkButton href="/export/report.csv" download aria-disabled={!hasReport || undefined}>{t("actions.download")}</LinkButton>
 */
export function LinkButton(handle: Handle<LinkButton.Props>) {
	return () => {
		let { color, variant, size, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedSize = size ?? DEFAULT_SIZE;

		return (
			<a
				{...rest}
				data-color={resolvedColor}
				data-variant={resolvedVariant}
				data-size={resolvedSize}
				mix={[
					when("&:focus-visible", [
						outline({ color: "brand.ring", offset: 2 }),
						data("color", "neutral", outline("neutral.ring")),
						data("color", "success", outline("success.ring")),
						data("color", "warning", outline("warning.ring")),
						data("color", "danger", outline("danger.ring")),
					]),
					interactiveTransition(),
					inlineFlex(),
					items("center"),
					justify("center"),
					gap(2),
					/**
					 * An icon inside a link button never shrinks — the same rule `Button` states, for the
					 * same reason: squeeze the row and the default `flex-shrink: 1` compresses the glyph
					 * rather than the words, and a squashed icon reads as a rendering fault.
					 */
					when("& > svg", shrink()),
					rounded("md"),
					weight("medium"),
					pi(4),
					pb(2),
					// Every variant carries the same border width, colored to match its
					// own fill (transparent for ghost) — so solid/ghost render exactly
					// the same footprint as outline instead of shrinking by the border.
					border({ width: 2 }),
					data("size", "sm", [pi(3), pb(1.5)]),
					data("size", "lg", [pi(5), pb(2.5), text("base")]),

					data("variant", "solid", [
						data("color", "brand", [
							bg("brand.solid"),
							border("brand.solid"),
							fg("brand.onSolid"),
							hover([bg("brand.bg-solid-hover"), border("brand.bg-solid-hover")]),
							active([bg("brand.bg-solid-pressed"), border("brand.bg-solid-pressed")]),
						]),
						data("color", "neutral", [
							bg("neutral.solid"),
							border("neutral.solid"),
							fg("neutral.onSolid"),
							hover([bg("neutral.bg-solid-hover"), border("neutral.bg-solid-hover")]),
							active([bg("neutral.bg-solid-pressed"), border("neutral.bg-solid-pressed")]),
						]),
						data("color", "success", [
							bg("success.solid"),
							border("success.solid"),
							fg("success.onSolid"),
							hover([bg("success.bg-solid-hover"), border("success.bg-solid-hover")]),
							active([bg("success.bg-solid-pressed"), border("success.bg-solid-pressed")]),
						]),
						data("color", "warning", [
							bg("warning.solid"),
							border("warning.solid"),
							fg("warning.onSolid"),
							hover([bg("warning.bg-solid-hover"), border("warning.bg-solid-hover")]),
							active([bg("warning.bg-solid-pressed"), border("warning.bg-solid-pressed")]),
						]),
						data("color", "danger", [
							bg("danger.solid"),
							border("danger.solid"),
							fg("danger.onSolid"),
							hover([bg("danger.bg-solid-hover"), border("danger.bg-solid-hover")]),
							active([bg("danger.bg-solid-pressed"), border("danger.bg-solid-pressed")]),
						]),
					]),

					data("variant", "outline", [
						data("color", "brand", [
							border("brand.strong"),
							fg("brand"),
							hover(bg("brand.tint")),
							active(bg("brand.bg-tint-hover")),
						]),
						data("color", "neutral", [
							border("neutral.strong"),
							fg("neutral"),
							hover(bg("neutral.tint")),
							active(bg("neutral.bg-tint-hover")),
						]),
						data("color", "success", [
							border("success.strong"),
							fg("success"),
							hover(bg("success.tint")),
							active(bg("success.bg-tint-hover")),
						]),
						data("color", "warning", [
							border("warning.strong"),
							fg("warning"),
							hover(bg("warning.tint")),
							active(bg("warning.bg-tint-hover")),
						]),
						data("color", "danger", [
							border("danger.strong"),
							fg("danger"),
							hover(bg("danger.tint")),
							active(bg("danger.bg-tint-hover")),
						]),
					]),
					data("variant", "outline", bg("transparent")),

					data("variant", "ghost", [
						data("color", "brand", [
							fg("brand"),
							hover(bg("brand.tint")),
							active(bg("brand.bg-tint-hover")),
						]),
						data("color", "neutral", [
							fg("neutral"),
							hover(bg("neutral.bg-tint-hover")),
							active(bg("neutral.bg-tint-pressed")),
						]),
						data("color", "success", [
							fg("success"),
							hover(bg("success.tint")),
							active(bg("success.bg-tint-hover")),
						]),
						data("color", "warning", [
							fg("warning"),
							hover(bg("warning.tint")),
							active(bg("warning.bg-tint-hover")),
						]),
						data("color", "danger", [
							fg("danger"),
							hover(bg("danger.tint")),
							active(bg("danger.bg-tint-hover")),
						]),
					]),
					data("variant", "ghost", [bg("transparent"), border("transparent")]),

					when('&[aria-disabled="true"]', opacity(50)),
					when('&[aria-disabled="true"]', [cursor("not-allowed"), pointerEvents()]),

					cursor("default"),
					userSelect(),

					text("sm"),

					data("size", "sm", text("xs")),
					mix,
				]}
			/>
		);
	};
}
