/**
 * A single-line native form field for free text entry, rendered as a
 * bordered, rounded `<input>` whose border, background, and focus ring read
 * from a semantic color role. It supplies the field's own box styling only,
 * ready to compose alongside a paired label, hint, and validation message,
 * and serves as the shared foundation every other single-line text control
 * in this library builds on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { css } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";

/** Semantic color role {@link Input} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Input.Color = "neutral";

/**
 * Prop types for {@link Input}.
 */
export namespace Input {
	/**
	 * Semantic color role for the focus-visible ring, each mapped to its
	 * matching `--ui-*` variables. A field marked invalid always reads the
	 * danger tone for its ring instead, regardless of `color` — see
	 * {@link Input}'s own description.
	 */
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Every native `<input>` attribute, unchanged, plus the `mix` passthrough.
	 * `type` stays open to every value the platform supports (`"text"`,
	 * `"email"`, `"password"`, `"tel"`, `"url"`, `"search"`, and the rest),
	 * with `role` narrowed to match whichever `type` is set, the same
	 * correlation the platform itself defines between the two. `placeholder`
	 * renders in a muted tone, and `aria-invalid` together with the
	 * platform's own post-interaction validity state drives the invalid
	 * styling. `aria-label`, `aria-labelledby`, and `aria-describedby` wire
	 * the field to a paired label, hint, or validation message the same way
	 * they would on a bare input.
	 */
	export type Props = TagProps<"input"> & {
		/** Semantic color role for the focus-visible ring. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
	};
}

/**
 * Renders a native `<input>` host styled as a bordered, rounded field at the
 * library's default control height, colored through the `data-color`
 * attribute contract. Hover, focus, and disabled states are driven entirely
 * by this host's own native `:hover`, `:focus`/`:focus-visible`, and
 * `:disabled` pseudo-classes, so the field's interactive behavior stays
 * fully native and keeps working the same way with the platform's own
 * baseline.
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
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the field's markup.
 * @example
 * <Label htmlFor="email">{t("form.email.label")}</Label>
 * <Input id="email" type="email" required />
 * @example
 * <Input
 * 	aria-label={t("form.search.label")}
 * 	color="primary"
 * 	placeholder={t("form.search.placeholder")}
 * />
 * @example
 * <Input id="username" aria-describedby="username-error" aria-invalid="true" />
 * <FieldError id="username-error">{t("form.username.taken")}</FieldError>
 */
export function Input(handle: Handle<Input.Props>) {
	return () => {
		let { color, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		return (
			<input
				{...rest}
				data-color={resolvedColor}
				mix={[
					interactiveTransition(),
					css({
						display: "block",
						inlineSize: "100%",
						blockSize: "2.5rem",
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
