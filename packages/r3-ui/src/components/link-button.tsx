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

import { bg, border, fg } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { gap, inlineFlex, items, justify } from "@pkg/u/layout";
import { pb, pi } from "@pkg/u/size";
import { active, hover, when } from "@pkg/u/state";
import { text, weight } from "@pkg/u/typography";
import { css } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { focusRingByColor } from "../styles/focus-ring";
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
					focusRingByColor(),
					interactiveTransition(),
					inlineFlex(),
					items("center"),
					justify("center"),
					gap(2),
					rounded("md"),
					weight("medium"),
					pi(4),
					pb(2),
					when('&[data-size="sm"]', [pi(3), pb(1.5)]),
					when('&[data-size="lg"]', [pi(5), pb(2.5), text("base")]),

					when('&[data-variant="solid"]', [
						when('&[data-color="primary"]', [
							bg("primary.solid"),
							fg("primary.onSolid"),
							hover(bg("primary.bg-solid-hover")),
							active(bg("primary.bg-solid-pressed")),
						]),
						when('&[data-color="neutral"]', [
							bg("neutral.solid"),
							fg("neutral.onSolid"),
							hover(bg("neutral.bg-solid-hover")),
							active(bg("neutral.bg-solid-pressed")),
						]),
						when('&[data-color="success"]', [
							bg("success.solid"),
							fg("success.onSolid"),
							hover(bg("success.bg-solid-hover")),
							active(bg("success.bg-solid-pressed")),
						]),
						when('&[data-color="warning"]', [
							bg("warning.solid"),
							fg("warning.onSolid"),
							hover(bg("warning.bg-solid-hover")),
							active(bg("warning.bg-solid-pressed")),
						]),
						when('&[data-color="danger"]', [
							bg("danger.solid"),
							fg("danger.onSolid"),
							hover(bg("danger.bg-solid-hover")),
							active(bg("danger.bg-solid-pressed")),
						]),
					]),

					when('&[data-variant="outline"]', [
						border({ width: 2 }),
						when('&[data-color="primary"]', [
							border("primary.strong"),
							fg("primary"),
							hover(bg("primary.tint")),
							active(bg("primary.bg-tint-hover")),
						]),
						when('&[data-color="neutral"]', [
							border("neutral.strong"),
							fg("neutral"),
							hover(bg("neutral.tint")),
							active(bg("neutral.bg-tint-hover")),
						]),
						when('&[data-color="success"]', [
							border("success.strong"),
							fg("success"),
							hover(bg("success.tint")),
							active(bg("success.bg-tint-hover")),
						]),
						when('&[data-color="warning"]', [
							border("warning.strong"),
							fg("warning"),
							hover(bg("warning.tint")),
							active(bg("warning.bg-tint-hover")),
						]),
						when('&[data-color="danger"]', [
							border("danger.strong"),
							fg("danger"),
							hover(bg("danger.tint")),
							active(bg("danger.bg-tint-hover")),
						]),
					]),
					css({ '&[data-variant="outline"]': { backgroundColor: "transparent" } }),

					when('&[data-variant="ghost"]', [
						when('&[data-color="primary"]', [
							fg("primary"),
							hover(bg("primary.tint")),
							active(bg("primary.bg-tint-hover")),
						]),
						when('&[data-color="neutral"]', [
							fg("neutral"),
							hover(bg("neutral.bg-tint-hover")),
							active(bg("neutral.bg-tint-pressed")),
						]),
						when('&[data-color="success"]', [
							fg("success"),
							hover(bg("success.tint")),
							active(bg("success.bg-tint-hover")),
						]),
						when('&[data-color="warning"]', [
							fg("warning"),
							hover(bg("warning.tint")),
							active(bg("warning.bg-tint-hover")),
						]),
						when('&[data-color="danger"]', [
							fg("danger"),
							hover(bg("danger.tint")),
							active(bg("danger.bg-tint-hover")),
						]),
					]),
					css({ '&[data-variant="ghost"]': { backgroundColor: "transparent" } }),

					when('&[aria-disabled="true"]', opacity(50)),
					css({
						'&[aria-disabled="true"]': { cursor: "not-allowed", pointerEvents: "none" },
					}),

					css({
						cursor: "default",
						userSelect: "none",

						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",

						'&[data-size="sm"]': {
							fontSize: "0.75rem",
							lineHeight: "calc(1 / 0.75)",
						},
					}),
					mix,
				]}
			/>
		);
	};
}
