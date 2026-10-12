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

import type { Handle, Props as TagProps } from "remix/component";

import { bg, border, fg, outline } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { block } from "@sdxc/u/layout";
import { bs, is, pb, pi } from "@sdxc/u/size";
import { focusVisible, hover, invalid, when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

import { interactiveTransition } from "../styles/interactive-transition.js";

/** Semantic color role {@link Input} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Input.Color = "neutral";

/**
 * Prop types for {@link Input}.
 */
export namespace Input {
	/**
	 * Semantic color role for the focus-visible ring, each mapped to its
	 * matching `--ui-*` variables. A field marked invalid always reads the
	 * danger tone for its ring regardless of `color`.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Every native `<input>` attribute, unchanged, plus the `mix`
	 * passthrough. `role` narrows to match whichever `type` is set, the
	 * same correlation the platform itself defines between the two.
	 */
	export type Props = TagProps<"input"> & {
		/** Semantic color role for the focus-visible ring. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
	};
}

/**
 * Renders a native `<input>` host colored via `data-color`, with hover,
 * focus, and disabled states driven by native pseudo-classes; `[aria-invalid="true"]`
 * together with `:user-invalid` forces the danger tone regardless of `color`.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the field's markup.
 * @example
 * <Label htmlFor="email">{t("form.email.label")}</Label>
 * <Input id="email" type="email" required />
 * @example
 * <Input
 * 	aria-label={t("form.search.label")}
 * 	color="brand"
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
					block(),
					is("full"),
					bs(10),
					rounded("md"),
					border({ color: "neutral", width: 1 }),
					bg("neutral.tint"),
					fg("neutral.emphasis"),
					pi(3),
					pb(2),
					when("&::placeholder", fg("neutral.muted")),
					hover(border("neutral.border-hover")),
					/**
					 * Focus draws a ring standing off the field, as every button here does, and the border
					 * steps only to its hover weight: a strong border flush with the ring reads as the field
					 * changing shape.
					 */
					when("&:focus", border("neutral.border-hover")),
					/**
					 * Pointer focus drops the platform outline and keyboard focus keeps the ring below. The
					 * selectors exclude each other because `outline: none` is a shorthand, and from a later
					 * cascade layer it resets the ring's color, width and style at once.
					 */
					when("&:focus:not(:focus-visible)", outline("none")),
					focusVisible([
						border("neutral.border-hover"),
						outline({ color: "brand.ring", offset: 2 }),
						when('&[data-color="success"]', outline("success.ring")),
						when('&[data-color="warning"]', outline("warning.ring")),
						when('&[data-color="danger"]', outline("danger.ring")),
					]),
					invalid([border("danger"), outline({ color: "danger.ring", offset: 2 })]),
					when("&:disabled", [opacity(50), bg("neutral.bg-tint-hover"), cursor("not-allowed")]),
					text("sm"),
					mix,
				]}
			/>
		);
	};
}
