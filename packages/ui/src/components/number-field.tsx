/**
 * A numeric field pairing a native `<input type="number">` control with a
 * decrement and an increment button, all three sharing one bordered,
 * rounded frame. The frame draws its own box styling and keyboard focus
 * ring, so the input inside sits flush against its neighboring buttons
 * instead of carrying a competing border of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { MinusIcon, PlusIcon } from "@sdxc/icons";
import { bg, border, borderEdge, fg, outline, outlineWidth } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { basis, flex, grow, inlineFlex, items, justify, shrink } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { active, focusVisible, hover, invalid, when } from "@sdxc/u/state";
import { textAlign } from "@sdxc/u/typography";
import { attrs } from "remix/ui";

import { fieldStackLayout } from "../styles/field-stack-layout";
import { interactiveTransition } from "../styles/interactive-transition";

import { Input } from "./input";

/**
 * ARIA role applied to {@link NumberField.Group} through {@link attrs}
 * unless a consumer supplies its own `role`, announcing the frame as one
 * related unit to assistive technology.
 */
const DEFAULT_ROLE = "group";

/**
 * Native `<button>` `type` {@link NumberField.DecrementButton} and
 * {@link NumberField.IncrementButton} fall back to when a consumer doesn't
 * supply one, keeping a click on either from submitting a surrounding `<form>`.
 */
const DEFAULT_BUTTON_TYPE: NonNullable<NumberField.DecrementButtonProps["type"]> = "button";

/**
 * Shared box, color, and interaction-state styling for
 * {@link NumberField.DecrementButton} and {@link NumberField.IncrementButton},
 * differing only in which inline edge carries the divider border.
 *
 * @param dividerEdge Which inline edge carries the divider border: `"end"` for the control preceding the input, `"start"` for the one following it.
 * @returns The mixins shared by both stepper buttons.
 */
function stepperButtonMix(dividerEdge: "start" | "end") {
	return [
		interactiveTransition(),
		flex(),
		items("center"),
		justify("center"),
		is("2.5rem"),
		fg("neutral"),
		border("neutral"),
		borderEdge(dividerEdge === "start" ? "inline-start" : "inline-end", { width: 1 }),
		hover(bg("neutral.bg-tint-hover")),
		active(bg("neutral.bg-tint-pressed")),
		when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
		rounded("none"),
		bg("transparent"),
		when("& svg", [is("1rem"), bs("1rem")]),
		when("&:disabled", [cursor("not-allowed"), opacity(50)]),
	];
}

/**
 * Prop types for {@link NumberField} and its compound parts.
 */
export namespace NumberField {
	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` composes this field's parts — typically a caption, the
	 * {@link NumberField.Group} row, and any supporting or validation copy.
	 */
	export interface Props extends TagProps<"div"> {}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` composes {@link NumberField.DecrementButton},
	 * {@link NumberField.Input}, and {@link NumberField.IncrementButton}.
	 */
	export interface GroupProps extends TagProps<"div"> {}

	/**
	 * Every prop {@link Input.Props} accepts except `type` and `role`, fixed to
	 * `"number"` and the platform's own `spinbutton` role, and `color`, unexposed
	 * since the keyboard focus ring is deferred to {@link NumberField.Group}.
	 */
	export interface InputProps extends Omit<Input.Props, "type" | "role" | "color"> {}

	/**
	 * Every native `<button>` attribute except `children`, which stays fixed
	 * to this button's own decrement glyph, plus the `mix` passthrough.
	 * `type` defaults to {@link DEFAULT_BUTTON_TYPE}.
	 */
	export interface DecrementButtonProps extends Omit<TagProps<"button">, "children"> {}

	/**
	 * Every native `<button>` attribute except `children`, which stays fixed
	 * to this button's own increment glyph, plus the `mix` passthrough.
	 * `type` defaults to {@link DEFAULT_BUTTON_TYPE}.
	 */
	export interface IncrementButtonProps extends Omit<TagProps<"button">, "children"> {}
}

/**
 * Renders a plain host stacking this field's compound parts in a single
 * column with a small gap between them: typically a caption, the
 * {@link NumberField.Group} row, and any supporting or validation copy.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the field's markup.
 * @example
 * <NumberField>
 * 	<Label htmlFor="quantity">{t("form.quantity.label")}</Label>
 * 	<NumberField.Group>
 * 		<NumberField.DecrementButton aria-label={t("stepper.decrement")} />
 * 		<NumberField.Input id="quantity" name="quantity" min={0} max={10} defaultValue={1} />
 * 		<NumberField.IncrementButton aria-label={t("stepper.increment")} />
 * 	</NumberField.Group>
 * </NumberField>
 */
export function NumberField(handle: Handle<NumberField.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} data-slot="number-field" mix={[fieldStackLayout(), mix]} />;
	};
}

/**
 * Renders {@link NumberField}'s frame: a `role="group"` `<div>` drawing a
 * bordered, rounded, tinted-background box that reads as one seamless
 * control, ringing the whole frame via `:focus-within` when a child gains focus.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the frame's markup.
 * @example
 * <NumberField.Group>
 * 	<NumberField.DecrementButton aria-label={t("stepper.decrement")} />
 * 	<NumberField.Input aria-label={t("form.quantity.label")} />
 * 	<NumberField.IncrementButton aria-label={t("stepper.increment")} />
 * </NumberField.Group>
 */
NumberField.Group = function NumberFieldGroup(handle: Handle<NumberField.GroupProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="group"
				mix={[
					attrs({ role: DEFAULT_ROLE }),
					inlineFlex(),
					items("stretch"),
					is("full"),
					rounded("md"),
					border({ color: "neutral", width: 1 }),
					bg("neutral.tint"),
					fg("neutral.emphasis"),
					hover(border("neutral.strong")),
					when("&:focus-within", [
						outline({ color: "brand.ring", offset: 0 }),
						border("brand.ring"),
					]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link NumberField}'s control: a native `<input type="number">`
 * built on {@link Input}. The stepper buttons need a separately wired
 * `stepUp()`/`stepDown()` for press-and-hold repeat; typed entry works without it.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <NumberField.Input aria-label={t("form.quantity.label")} min={0} max={10} defaultValue={1} />
 * @example
 * <NumberField.Input id="price" name="price" step={0.01} aria-invalid="true" />
 */
NumberField.Input = function NumberFieldInput(handle: Handle<NumberField.InputProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<Input
				type="number"
				{...rest}
				mix={[
					textAlign("center"),
					rounded("none"),
					grow(),
					shrink(1),
					basis("0%"),
					border({ width: "0", noStyleDefault: true }),
					raw({
						"-moz-appearance": "textfield",

						"&::-webkit-inner-spin-button, &::-webkit-outer-spin-button": {
							"-webkit-appearance": "none",
							margin: "0",
						},
					}),
					bg("transparent"),
					fg("inherit"),
					when("&:disabled", bg("transparent")),
					focusVisible(outlineWidth("0")),
					invalid([outlineWidth("0"), fg("danger")]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a native `<button>` decrementing {@link NumberField.Input}'s
 * value; its glyph is `aria-hidden`, so callers must supply an `aria-label`.
 * In dev mode, a missing `aria-label`/`aria-labelledby` logs a `console.warn`.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <NumberField.DecrementButton aria-label={t("stepper.decrement")} />
 * @example
 * <NumberField.DecrementButton aria-label={t("stepper.decrement")} disabled={quantity <= 0} />
 */
NumberField.DecrementButton = function NumberFieldDecrementButton(
	handle: Handle<NumberField.DecrementButtonProps>,
) {
	return () => {
		let { type, mix, ...rest } = handle.props;

		if (import.meta.env.DEV && !handle.props["aria-label"] && !handle.props["aria-labelledby"]) {
			console.warn(
				"NumberField.DecrementButton: needs an `aria-label` describing what it does — its content is a decorative glyph with no accessible name of its own.",
			);
		}

		return (
			<button
				type={type ?? DEFAULT_BUTTON_TYPE}
				{...rest}
				data-slot="decrement"
				mix={[stepperButtonMix("end"), mix]}
			>
				<MinusIcon />
			</button>
		);
	};
};

/**
 * Renders a native `<button>` incrementing {@link NumberField.Input}'s
 * value; its glyph is `aria-hidden`, so callers must supply an `aria-label`.
 * In dev mode, a missing `aria-label`/`aria-labelledby` logs a `console.warn`.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <NumberField.IncrementButton aria-label={t("stepper.increment")} />
 * @example
 * <NumberField.IncrementButton aria-label={t("stepper.increment")} disabled={quantity >= 10} />
 */
NumberField.IncrementButton = function NumberFieldIncrementButton(
	handle: Handle<NumberField.IncrementButtonProps>,
) {
	return () => {
		let { type, mix, ...rest } = handle.props;

		if (import.meta.env.DEV && !handle.props["aria-label"] && !handle.props["aria-labelledby"]) {
			console.warn(
				"NumberField.IncrementButton: needs an `aria-label` describing what it does — its content is a decorative glyph with no accessible name of its own.",
			);
		}

		return (
			<button
				type={type ?? DEFAULT_BUTTON_TYPE}
				{...rest}
				data-slot="increment"
				mix={[stepperButtonMix("start"), mix]}
			>
				<PlusIcon />
			</button>
		);
	};
};
