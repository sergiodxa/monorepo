/**
 * A styled native checkbox: an `<input type="checkbox">` paired with a
 * decorative glyph box that renders its check or dash mark purely from the
 * input's own state, wrapped in a `<label>` so clicking or tapping anywhere
 * in the row — box, glyph, or label text alike — toggles the control.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { CheckIcon, MinusIcon } from "@pkg/icons";
import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, fg, outline } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor } from "@pkg/u/general";
import { block, center, hidden, hstack, relative, shrink } from "@pkg/u/layout";
import { bs, is } from "@pkg/u/size";
import { when } from "@pkg/u/state";

import { interactiveTransition } from "../styles/interactive-transition";
import { warnIfNoAccessibleName } from "../utils/warn-if-no-accessible-name";

/** Semantic color role {@link Checkbox} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Checkbox.Color = "neutral";

/**
 * Prop types for {@link Checkbox}.
 */
export namespace Checkbox {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Per-part styling for the elements this convenience wrapper composes
	 * internally alongside its own host `<input>`.
	 */
	export interface PartsProps {
		/** Styling for the decorative box rendering the checkmark or dash glyph. */
		box?: TagProps<"span">["mix"];
	}

	/**
	 * Props accepted by {@link Checkbox}. Extends every native `<input>`
	 * attribute except `type`, fixed to `"checkbox"`; `mix` styles that same
	 * `<input>` host, and `role` is narrowed to what a checkbox input allows.
	 */
	export interface Props extends Omit<TagProps<"input">, "type" | "role"> {
		/** ARIA role override, restricted to what a checkbox input may carry. */
		role?: "checkbox" | "button" | "menuitemcheckbox" | "option" | "switch";
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/**
		 * Label content rendered after the box, inside the same native
		 * `<label>` wrapping the row — clicking any of it toggles the checkbox
		 * natively, with no separate `htmlFor`/`id` pair required.
		 */
		children?: RemixNode;
		/** Per-part styling for this wrapper's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * The box precedes the input in source order so its `:has(~ input:…)` rules
 * can read state directly off it, keeping the whole control CSS-driven;
 * `shrink(0)` also keeps the box square regardless of label length.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the checkbox's markup.
 * @example
 * <Checkbox name="terms" required>{t("signup.acceptTerms")}</Checkbox>
 * @example
 * <Checkbox color="danger" checked={row.flagged} aria-label={t("table.flagRow")} />
 * @example
 * <Checkbox disabled defaultChecked>{t("settings.legacyOptIn")}</Checkbox>
 */
export function Checkbox(handle: Handle<Checkbox.Props>) {
	return () => {
		let { color, children, parts, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		warnIfNoAccessibleName(
			handle.props,
			children,
			"Checkbox: a checkbox with no visible label text needs an `aria-label` describing what it toggles — assistive technology has no accessible name to announce otherwise.",
		);

		return (
			<label mix={[relative(), hstack({ gap: 2, align: "center" })]}>
				<span
					aria-hidden="true"
					data-slot="box"
					data-color={resolvedColor}
					mix={[
						center(),
						is("1.25rem"),
						bs("1.25rem"),
						shrink(0),
						rounded("sm"),
						border({ width: 2, color: "neutral.strong" }),
						bg("neutral.tint"),
						interactiveTransition(),

						when("& > svg", [hidden(), is("0.75rem"), bs("0.75rem")]),
						when("&:has(~ input:checked) > svg:first-child", block()),
						when("&:has(~ input:indeterminate) > svg:last-child", block()),

						when(
							'&[data-color="brand"]',
							when("&:has(~ input:checked), &:has(~ input:indeterminate)", [
								border("brand.solid"),
								bg("brand.solid"),
								fg("brand.onSolid"),
							]),
						),
						when(
							'&[data-color="neutral"]',
							when("&:has(~ input:checked), &:has(~ input:indeterminate)", [
								border("neutral.solid"),
								bg("neutral.solid"),
								fg("neutral.onSolid"),
							]),
						),
						when(
							'&[data-color="success"]',
							when("&:has(~ input:checked), &:has(~ input:indeterminate)", [
								border("success.solid"),
								bg("success.solid"),
								fg("success.onSolid"),
							]),
						),
						when(
							'&[data-color="warning"]',
							when("&:has(~ input:checked), &:has(~ input:indeterminate)", [
								border("warning.solid"),
								bg("warning.solid"),
								fg("warning.onSolid"),
							]),
						),
						when(
							'&[data-color="danger"]',
							when("&:has(~ input:checked), &:has(~ input:indeterminate)", [
								border("danger.solid"),
								bg("danger.solid"),
								fg("danger.onSolid"),
							]),
						),

						when("&:has(~ input:focus-visible)", [
							outline({ color: "brand.ring", offset: 2 }),
							when('&[data-color="neutral"]', outline("neutral.ring")),
							when('&[data-color="success"]', outline("success.ring")),
							when('&[data-color="warning"]', outline("warning.ring")),
							when('&[data-color="danger"]', outline("danger.ring")),
						]),

						when("&:has(~ input:disabled)", [cursor("not-allowed"), opacity(50)]),

						parts?.box,
					]}
				>
					<CheckIcon />
					<MinusIcon />
				</span>
				<input type="checkbox" {...rest} mix={[visuallyHidden(), mix]} />
				{children}
			</label>
		);
	};
}
