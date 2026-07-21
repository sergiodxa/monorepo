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
					css({
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "0.5rem",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						fontWeight: "500",
						cursor: "default",
						userSelect: "none",

						paddingInline: "1rem",
						paddingBlock: "0.5rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",

						'&[data-size="sm"]': {
							paddingInline: "0.75rem",
							paddingBlock: "0.375rem",
							fontSize: "0.75rem",
							lineHeight: "calc(1 / 0.75)",
						},
						'&[data-size="lg"]': {
							paddingInline: "1.25rem",
							paddingBlock: "0.625rem",
							fontSize: "1rem",
							lineHeight: "1.5",
						},

						'&[data-variant="solid"]': {
							'&[data-color="primary"]': {
								backgroundColor: "var(--ui-primary-bg-solid)",
								color: "var(--ui-primary-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-primary-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-primary-bg-solid-pressed)" },
							},
							'&[data-color="neutral"]': {
								backgroundColor: "var(--ui-neutral-bg-solid)",
								color: "var(--ui-neutral-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-neutral-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-neutral-bg-solid-pressed)" },
							},
							'&[data-color="success"]': {
								backgroundColor: "var(--ui-success-bg-solid)",
								color: "var(--ui-success-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-success-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-success-bg-solid-pressed)" },
							},
							'&[data-color="warning"]': {
								backgroundColor: "var(--ui-warning-bg-solid)",
								color: "var(--ui-warning-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-warning-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-warning-bg-solid-pressed)" },
							},
							'&[data-color="danger"]': {
								backgroundColor: "var(--ui-danger-bg-solid)",
								color: "var(--ui-danger-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-danger-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-danger-bg-solid-pressed)" },
							},
						},

						'&[data-variant="outline"]': {
							borderWidth: "2px",
							backgroundColor: "transparent",
							'&[data-color="primary"]': {
								borderColor: "var(--ui-primary-border-strong)",
								color: "var(--ui-primary-fg)",
								"&:hover": { backgroundColor: "var(--ui-primary-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-primary-bg-tint-hover)" },
							},
							'&[data-color="neutral"]': {
								borderColor: "var(--ui-neutral-border-strong)",
								color: "var(--ui-neutral-fg)",
								"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
							},
							'&[data-color="success"]': {
								borderColor: "var(--ui-success-border-strong)",
								color: "var(--ui-success-fg)",
								"&:hover": { backgroundColor: "var(--ui-success-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-success-bg-tint-hover)" },
							},
							'&[data-color="warning"]': {
								borderColor: "var(--ui-warning-border-strong)",
								color: "var(--ui-warning-fg)",
								"&:hover": { backgroundColor: "var(--ui-warning-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-warning-bg-tint-hover)" },
							},
							'&[data-color="danger"]': {
								borderColor: "var(--ui-danger-border-strong)",
								color: "var(--ui-danger-fg)",
								"&:hover": { backgroundColor: "var(--ui-danger-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-danger-bg-tint-hover)" },
							},
						},

						'&[data-variant="ghost"]': {
							backgroundColor: "transparent",
							'&[data-color="primary"]': {
								color: "var(--ui-primary-fg)",
								"&:hover": { backgroundColor: "var(--ui-primary-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-primary-bg-tint-hover)" },
							},
							'&[data-color="neutral"]': {
								color: "var(--ui-neutral-fg)",
								"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
								"&:active": { backgroundColor: "var(--ui-neutral-bg-tint-pressed)" },
							},
							'&[data-color="success"]': {
								color: "var(--ui-success-fg)",
								"&:hover": { backgroundColor: "var(--ui-success-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-success-bg-tint-hover)" },
							},
							'&[data-color="warning"]': {
								color: "var(--ui-warning-fg)",
								"&:hover": { backgroundColor: "var(--ui-warning-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-warning-bg-tint-hover)" },
							},
							'&[data-color="danger"]': {
								color: "var(--ui-danger-fg)",
								"&:hover": { backgroundColor: "var(--ui-danger-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-danger-bg-tint-hover)" },
							},
						},

						'&[aria-disabled="true"]': {
							cursor: "not-allowed",
							pointerEvents: "none",
							opacity: "0.5",
						},
					}),
					mix,
				]}
			/>
		);
	};
}
