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

import { border, bg, fg, outline } from "@sdxc/u/color";
import { rounded, opacity } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { block } from "@sdxc/u/layout";
import { is, bs, minBs, pi, pb } from "@sdxc/u/size";
import { when, hover, invalid } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

import { interactiveTransition } from "../styles/interactive-transition.js";

/** Semantic color role {@link TextArea} falls back to when `color` is omitted. */
const DEFAULT_COLOR: TextArea.Color = "neutral";

/**
 * Prop types for {@link TextArea}.
 */
export namespace TextArea {
	/**
	 * Semantic color role for the focus-visible ring, each mapped to its
	 * matching `--ui-*` variables. A field marked invalid always reads the
	 * danger tone for its ring instead, regardless of `color`.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Every native `<textarea>` attribute, unchanged, plus the `mix`
	 * passthrough. `aria-invalid` together with the platform's own
	 * post-interaction validity state drives the invalid styling.
	 */
	export type Props = TagProps<"textarea"> & {
		/** Semantic color role for the focus-visible ring. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
	};
}

/**
 * Renders a native `<textarea>` host styled as a bordered, rounded field,
 * colored through the `data-color` attribute contract — the same visual
 * language as {@link Input}, rendering only the field itself.
 *
 * @param handle Runtime handle carrying the host `<textarea>`'s props.
 * @returns The render function producing the field's markup.
 * @example
 * <Label htmlFor="bio">{t("form.bio.label")}</Label>
 * <TextArea id="bio" name="bio" />
 * @example
 * <TextArea
 * 	aria-label={t("form.comment.label")}
 * 	color="brand"
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
					block(),
					is("full"),
					bs("auto"),
					minBs("6rem"),
					rounded("md"),
					border({ color: "neutral", width: 1 }),
					bg("neutral.bg-tint"),
					fg("neutral.fg-emphasis"),
					pi("0.75rem"),
					pb("0.5rem"),
					when("&::placeholder", fg("neutral.fg-muted")),
					hover(border("neutral.border-strong")),
					when("&:focus", border("neutral.border-strong")),
					when("&:focus-visible", [
						outline({ color: "neutral.ring", offset: 0 }),
						border("neutral.border-strong"),
						when('&[data-color="brand"]', [
							border("brand.border-strong"),
							outline({ color: "brand.ring", offset: 0 }),
						]),
						when('&[data-color="success"]', [
							border("success.border-strong"),
							outline({ color: "success.ring", offset: 0 }),
						]),
						when('&[data-color="warning"]', [
							border("warning.border-strong"),
							outline({ color: "warning.ring", offset: 0 }),
						]),
						when('&[data-color="danger"]', [
							border("danger.border-strong"),
							outline({ color: "danger.ring", offset: 0 }),
						]),
					]),
					invalid([outline({ color: "danger.ring", offset: 0 }), border("danger.border-strong")]),
					when("&:disabled", [opacity(50), bg("neutral.bg-tint-hover"), cursor("not-allowed")]),
					text("sm"),
					raw({
						resize: "block",
						fieldSizing: "content",
					}),
					when("&:focus", outline("none")),
					mix,
				]}
			/>
		);
	};
}
