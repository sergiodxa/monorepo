/**
 * An interactive control for a single, immediate action — submitting a form,
 * triggering a command, opening a dialog. Its host renders as a native
 * `<button>`, colored and shaped through a semantic color role, a visual
 * weight variant, and a size, and can render a busy, non-interactive pending
 * state without losing its footprint or reflowing the page around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { LoaderCircleIcon } from "@pkg/lucide-remix";
import { css } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { focusRingByColor } from "../styles/focus-ring";
import { interactiveTransition } from "../styles/interactive-transition";
import { warnIfNoAccessibleName } from "../utils/warn-if-no-accessible-name";

/** Semantic color role {@link Button} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Button.Color = "neutral";

/** Visual weight {@link Button} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: Button.Variant = "solid";

/** Size variant {@link Button} falls back to when `size` is omitted. */
const DEFAULT_SIZE: Button.Size = "md";

/**
 * Prop types for {@link Button}.
 */
export namespace Button {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = SemanticColor;

	/**
	 * Visual weight the button renders with: a solid fill with an on-solid
	 * foreground, a transparent fill with a strong colored border, or a fully
	 * transparent fill with just a colored label.
	 */
	export type Variant = "solid" | "outline" | "ghost";

	/**
	 * Size variant controlling the button's padding and font size.
	 */
	export type Size = "sm" | "md" | "lg";

	/**
	 * Per-part styling for the elements a pending button renders besides its
	 * own host.
	 */
	export interface PartsProps {
		/** Styling for the decorative rotating glyph shown while pending. */
		spinner?: TagProps<"span">["mix"];
		/**
		 * Styling for the wrapper holding the button's own children while
		 * pending; kept in the layout to preserve the button's footprint, but
		 * hidden from view and from assistive technology.
		 */
		content?: TagProps<"span">["mix"];
	}

	/**
	 * Props accepted by {@link Button}.
	 */
	export interface Props extends TagProps<"button"> {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Visual weight. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
		/**
		 * Marks the button as busy: merges into the native `disabled` attribute
		 * so the button stops accepting input, and swaps its visible content for
		 * a decorative spinner glyph while keeping the button's rendered
		 * footprint unchanged, so a page mid-request never reflows around it.
		 */
		isPending?: boolean;
		/** Per-part styling for the pending state's internal elements. */
		parts?: PartsProps;
	}
}

/**
 * Renders a native `<button>` host, colored and shaped through the
 * `data-color`, `data-variant`, and `data-size` attribute contract:
 * `"solid"` fills the button with the color's solid background and
 * on-solid foreground, `"outline"` renders a strong colored border over a
 * transparent fill, and `"ghost"` renders just the colored label over a
 * transparent fill until hovered or pressed. Hover and pressed states ride
 * the native `:hover` and `:active` pseudo-classes, and a keyboard
 * focus-visible ring reads in the button's own semantic color.
 *
 * Setting `isPending` merges into the native `disabled` attribute — a
 * pending button stops accepting input the same way a genuinely disabled
 * one does — and swaps the button's visible content for a decorative
 * rotating glyph, while an invisible copy of the original content keeps the
 * button's rendered footprint unchanged. The glyph holds still on its own;
 * pair the `spin()` mixin from the animation layer through `parts.spinner`
 * for the rotating loop.
 *
 * In dev mode, a button whose content carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since assistive
 * technology otherwise has no accessible name to announce for it.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the button's markup.
 * @example
 * <Button type="submit">{t("actions.save")}</Button>
 * @example
 * <Button color="danger" variant="outline" size="sm">{t("actions.delete")}</Button>
 * @example
 * <Button type="submit" isPending={isSubmitting}>{t("actions.save")}</Button>
 */
export function Button(handle: Handle<Button.Props>) {
	return () => {
		let { color, variant, size, isPending, disabled, parts, children, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedSize = size ?? DEFAULT_SIZE;
		let resolvedDisabled = disabled || isPending;

		warnIfNoAccessibleName(
			handle.props,
			children,
			"Button: an icon-only button needs an `aria-label` describing what it does — assistive technology has no accessible text to announce otherwise.",
		);

		return (
			<button
				{...rest}
				data-color={resolvedColor}
				data-variant={resolvedVariant}
				data-size={resolvedSize}
				data-pending={isPending || undefined}
				disabled={resolvedDisabled}
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

						"&:disabled:not([data-pending])": {
							cursor: "not-allowed",
							opacity: "0.5",
						},

						"&[data-pending]": {
							position: "relative",
							cursor: "wait",
						},
					}),
					mix,
				]}
			>
				{isPending ? (
					<>
						<span
							aria-hidden="true"
							data-slot="spinner"
							mix={[
								css({
									position: "absolute",
									insetBlockStart: "0",
									insetBlockEnd: "0",
									insetInlineStart: "0",
									insetInlineEnd: "0",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",

									"& svg": {
										inlineSize: "var(--ui-spinner-icon-size-sm, 1rem)",
										blockSize: "var(--ui-spinner-icon-size-sm, 1rem)",
									},
									'[data-size="lg"] & svg': {
										inlineSize: "var(--ui-spinner-icon-size-md, 1.25rem)",
										blockSize: "var(--ui-spinner-icon-size-md, 1.25rem)",
									},
								}),
								parts?.spinner,
							]}
						>
							<LoaderCircleIcon aria-hidden />
						</span>
						<span
							data-slot="content"
							mix={[
								css({
									visibility: "hidden",
									display: "inline-flex",
									alignItems: "center",
									gap: "0.5rem",
								}),
								parts?.content,
							]}
						>
							{children}
						</span>
					</>
				) : (
					children
				)}
			</button>
		);
	};
}
