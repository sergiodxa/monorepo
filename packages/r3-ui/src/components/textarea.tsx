/**
 * A multi-line native form field for free text entry, rendered as a bordered,
 * rounded `<textarea>` that shares {@link Input}'s border, background, and
 * focus-ring contract. It starts at a comfortable minimum block size and
 * grows with its content through `field-sizing: content`, so a reply box or
 * a comment field never clips what's already been typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { css } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";

/** Semantic color role {@link TextArea} falls back to when `color` is omitted. */
const DEFAULT_COLOR: TextArea.Color = "neutral";

/**
 * Prop types for {@link TextArea}.
 */
export namespace TextArea {
	/**
	 * Semantic color role for the focus-visible ring, each mapped to its
	 * matching `--ui-*` variables. A field marked invalid always reads the
	 * danger tone for its ring instead, regardless of `color` — see
	 * {@link TextArea}'s own description.
	 */
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Every native `<textarea>` attribute, unchanged, plus the `mix`
	 * passthrough. `placeholder` renders in a muted tone, and
	 * `aria-invalid` together with the platform's own post-interaction
	 * validity state drives the invalid styling. `aria-label`,
	 * `aria-labelledby`, and `aria-describedby` wire the field to a paired
	 * label, hint, or validation message the same way they would on a bare
	 * textarea.
	 */
	export type Props = TagProps<"textarea"> & {
		/** Semantic color role for the focus-visible ring. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
	};
}

/**
 * Renders a native `<textarea>` host styled as a bordered, rounded field,
 * colored through the `data-color` attribute contract — the same visual
 * language as {@link Input}. Hover, focus, and disabled states are driven
 * entirely by this host's own native `:hover`, `:focus`/`:focus-visible`, and
 * `:disabled` pseudo-classes, so the field's interactive behavior stays fully
 * native and keeps working the same way with the platform's own baseline.
 *
 * The host starts at a minimum block size of six lines and sets
 * `field-sizing: content`, so it grows in the block direction to fit
 * whatever the reader has typed rather than scrolling internally. A manual
 * resize handle rides the block axis on top of that automatic growth for a
 * reader who wants more room than the content alone would claim.
 *
 * A keyboard focus-visible ring reads `color`, defaulting to
 * {@link DEFAULT_COLOR}. `[aria-invalid="true"]` (set directly, or mirrored
 * in by a validation script) together with `:user-invalid` (the platform's
 * own post-interaction validity signal) colors the border and ring in the
 * semantic danger tone regardless of `color`. A disabled field dims to half
 * opacity, swaps its cursor to "not-allowed", and tints its background, and
 * its placeholder text reads in the muted neutral foreground.
 *
 * Pair the field with a label through `htmlFor`/`id` (or by nesting the
 * field inside the label), a hint through `aria-describedby`, and a
 * validation message through that same `aria-describedby` list — this
 * component renders only the field itself, leaving the label, hint, and
 * validation message to those separate compositions.
 *
 * @param handle Runtime handle carrying the host `<textarea>`'s props.
 * @returns The render function producing the field's markup.
 * @example
 * <Label htmlFor="bio">{t("form.bio.label")}</Label>
 * <TextArea id="bio" name="bio" />
 * @example
 * <TextArea
 * 	aria-label={t("form.comment.label")}
 * 	color="primary"
 * 	placeholder={t("form.comment.placeholder")}
 * />
 * @example
 * <TextArea id="notes" aria-describedby="notes-error" aria-invalid="true" />
 * <FieldError id="notes-error">{t("form.notes.tooLong")}</FieldError>
 */
export function TextArea(handle: Handle<TextArea.Props>) {
	return () => {
		let { color, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		return (
			<textarea
				{...rest}
				data-color={resolvedColor}
				mix={[
					interactiveTransition(),
					css({
						display: "block",
						inlineSize: "100%",
						blockSize: "auto",
						minBlockSize: "6rem",
						resize: "block",
						fieldSizing: "content",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						borderWidth: "1px",
						borderStyle: "solid",
						borderColor: "var(--ui-neutral-border)",
						backgroundColor: "var(--ui-neutral-bg-tint)",
						color: "var(--ui-neutral-fg-emphasis)",
						paddingInline: "0.75rem",
						paddingBlock: "0.5rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",

						"&::placeholder": {
							color: "var(--ui-neutral-fg-muted)",
						},

						"&:hover": {
							borderColor: "var(--ui-neutral-border-strong)",
						},
						"&:focus": {
							outline: "none",
							borderColor: "var(--ui-neutral-border-strong)",
						},
						"&:focus-visible": {
							outlineWidth: "2px",
							outlineStyle: "solid",
							outlineOffset: "0px",
							borderColor: "var(--ui-neutral-border-strong)",
							outlineColor: "var(--ui-neutral-ring)",
							'&[data-color="primary"]': {
								borderColor: "var(--ui-primary-border-strong)",
								outlineColor: "var(--ui-primary-ring)",
							},
							'&[data-color="success"]': {
								borderColor: "var(--ui-success-border-strong)",
								outlineColor: "var(--ui-success-ring)",
							},
							'&[data-color="warning"]': {
								borderColor: "var(--ui-warning-border-strong)",
								outlineColor: "var(--ui-warning-ring)",
							},
							'&[data-color="danger"]': {
								borderColor: "var(--ui-danger-border-strong)",
								outlineColor: "var(--ui-danger-ring)",
							},
						},
						'&[aria-invalid="true"], &:user-invalid': {
							outlineWidth: "2px",
							outlineStyle: "solid",
							outlineOffset: "0px",
							borderColor: "var(--ui-danger-border-strong)",
							outlineColor: "var(--ui-danger-ring)",
						},
						"&:disabled": {
							cursor: "not-allowed",
							opacity: "0.5",
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						},
					}),
					mix,
				]}
			/>
		);
	};
}
