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

import { CheckIcon, MinusIcon } from "@pkg/lucide-remix";
import { css } from "remix/ui";

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
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Per-part styling for the elements this convenience wrapper composes
	 * internally alongside its own host `<input>`.
	 */
	export interface PartsProps {
		/** Styling for the decorative box rendering the checkmark or dash glyph. */
		box?: TagProps<"span">["mix"];
	}

	/**
	 * Props accepted by {@link Checkbox}. Every native `<input>` attribute is
	 * available unchanged — aside from `type`, which is always `"checkbox"` —
	 * so `checked`, `defaultChecked`, `disabled`, `required`, `name`, `value`,
	 * `aria-invalid`, `aria-describedby`, and the rest work exactly as they
	 * would on a bare input, and `mix` styles that same `<input>` host. `role`
	 * is narrowed to the set the platform allows on a checkbox input.
	 */
	export interface Props extends Omit<TagProps<"input">, "type" | "role"> {
		/** ARIA role override, restricted to what a checkbox input may carry. */
		role?: "checkbox" | "button" | "menuitemcheckbox" | "option" | "switch";
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/**
		 * Label content rendered after the box, inside the same native
		 * `<label>` wrapping the whole row — clicking or tapping any of it
		 * toggles the checkbox natively, with no separate `htmlFor`/`id` pair
		 * required.
		 */
		children?: RemixNode;
		/** Per-part styling for this wrapper's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * Renders a native `<input type="checkbox">` wrapped in a `<label>` alongside
 * a decorative glyph box, colored and shaped through the box's own
 * `data-color` attribute. The box's border, fill, glyph, and focus ring read
 * entirely from the input's own `:checked`, `:indeterminate`,
 * `:focus-visible`, and `:disabled` states through a `:has()` sibling query —
 * there is no tracked selection state anywhere in this module, and the whole
 * control keeps working with no JavaScript at all.
 *
 * The check glyph shows for `:checked`, the dash glyph shows for
 * `:indeterminate`. Unlike `checked`, the platform exposes no HTML attribute
 * for `indeterminate` — it is a DOM-only property set imperatively via
 * `element.indeterminate = true`, typically from a companion mixin reading a
 * "some but not all selected" state. This component's styling already
 * renders that state correctly the moment something sets it; the component
 * itself never sets it.
 *
 * In dev mode, a checkbox whose row carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since assistive
 * technology otherwise has no accessible name to announce for it.
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
			<label
				mix={[
					css({
						position: "relative",
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
					}),
				]}
			>
				{/*
				 * The box comes before the input in source order so its own
				 * `:has(~ input:…)` rules can read the input's state through the
				 * general sibling combinator, which only looks at *following*
				 * siblings. The input itself is visually hidden but stays in the
				 * tab order and keeps its native checkbox semantics.
				 */}
				<span
					aria-hidden="true"
					data-slot="box"
					data-color={resolvedColor}
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							inlineSize: "1.25rem",
							blockSize: "1.25rem",
							borderRadius: "var(--ui-radius-sm, 0.25rem)",
							borderWidth: "2px",
							borderColor: "var(--ui-neutral-border-strong)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							transitionProperty:
								"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
							transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
							transitionDuration: "150ms",

							"& > svg": {
								display: "none",
								inlineSize: "0.75rem",
								blockSize: "0.75rem",
							},
							"&:has(~ input:checked) > svg:first-child": { display: "block" },
							"&:has(~ input:indeterminate) > svg:last-child": { display: "block" },

							'&[data-color="primary"]': {
								"&:has(~ input:checked), &:has(~ input:indeterminate)": {
									borderColor: "var(--ui-primary-bg-solid)",
									backgroundColor: "var(--ui-primary-bg-solid)",
									color: "var(--ui-primary-fg-on-solid)",
								},
							},
							'&[data-color="neutral"]': {
								"&:has(~ input:checked), &:has(~ input:indeterminate)": {
									borderColor: "var(--ui-neutral-bg-solid)",
									backgroundColor: "var(--ui-neutral-bg-solid)",
									color: "var(--ui-neutral-fg-on-solid)",
								},
							},
							'&[data-color="success"]': {
								"&:has(~ input:checked), &:has(~ input:indeterminate)": {
									borderColor: "var(--ui-success-bg-solid)",
									backgroundColor: "var(--ui-success-bg-solid)",
									color: "var(--ui-success-fg-on-solid)",
								},
							},
							'&[data-color="warning"]': {
								"&:has(~ input:checked), &:has(~ input:indeterminate)": {
									borderColor: "var(--ui-warning-bg-solid)",
									backgroundColor: "var(--ui-warning-bg-solid)",
									color: "var(--ui-warning-fg-on-solid)",
								},
							},
							'&[data-color="danger"]': {
								"&:has(~ input:checked), &:has(~ input:indeterminate)": {
									borderColor: "var(--ui-danger-bg-solid)",
									backgroundColor: "var(--ui-danger-bg-solid)",
									color: "var(--ui-danger-fg-on-solid)",
								},
							},

							"&:has(~ input:focus-visible)": {
								outlineWidth: "2px",
								outlineStyle: "solid",
								outlineOffset: "2px",
								outlineColor: "var(--ui-primary-ring)",
								'&[data-color="neutral"]': { outlineColor: "var(--ui-neutral-ring)" },
								'&[data-color="success"]': { outlineColor: "var(--ui-success-ring)" },
								'&[data-color="warning"]': { outlineColor: "var(--ui-warning-ring)" },
								'&[data-color="danger"]': { outlineColor: "var(--ui-danger-ring)" },
							},

							"&:has(~ input:disabled)": {
								cursor: "not-allowed",
								opacity: "0.5",
							},
						}),
						parts?.box,
					]}
				>
					<CheckIcon aria-hidden />
					<MinusIcon aria-hidden />
				</span>
				<input
					type="checkbox"
					{...rest}
					mix={[
						css({
							position: "absolute",
							inlineSize: "1px",
							blockSize: "1px",
							margin: 0,
							overflow: "hidden",
							clipPath: "inset(50%)",
							whiteSpace: "nowrap",
						}),
						mix,
					]}
				/>
				{children}
			</label>
		);
	};
}
