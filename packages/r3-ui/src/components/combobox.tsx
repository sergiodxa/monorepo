/**
 * A single-line text control paired with a native list of suggested values: a
 * {@link ComboBox.Group} row housing the {@link ComboBox.Input} control and a
 * trailing {@link ComboBox.Button} disclosure glyph, all stacked beneath a
 * caption or above supporting copy in a single column with a small gap. The
 * text control builds on {@link Input} for its box, color, and interaction
 * states, and pairs with a plain `<datalist>` of `<option>`s through its own
 * `list` attribute — the browser renders and filters that list entirely on
 * its own, with no styling opportunity across the suggestions themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { ChevronDownIcon } from "@pkg/lucide-remix";
import { bg, fg, outline } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { center, hstack, spacer, vstack } from "@pkg/u/layout";
import { bs, is, mis, pie } from "@pkg/u/size";
import { when } from "@pkg/u/state";

import { interactiveTransition } from "../styles/interactive-transition";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

import { Input } from "./input";

/**
 * Native `<button>` `type` {@link ComboBox.Button} falls back to when a
 * consumer doesn't supply one, keeping a click on the button from submitting
 * a surrounding `<form>` the way a bare `<button>`'s default type otherwise
 * would.
 */
const DEFAULT_BUTTON_TYPE: NonNullable<ComboBox.ButtonProps["type"]> = "button";

/**
 * Prop types for {@link ComboBox} and its compound parts.
 */
export namespace ComboBox {
	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` composes this control's parts — typically a caption, the
	 * {@link ComboBox.Group} row, a paired `<datalist>`, and any supporting or
	 * validation copy — in a single column with a small gap between them.
	 */
	export interface Props extends TagProps<"div"> {}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` composes {@link ComboBox.Input} and {@link ComboBox.Button}
	 * into one visual row.
	 */
	export interface GroupProps extends TagProps<"div"> {}

	/**
	 * Every prop {@link Input.Props} accepts, unchanged. A type alias rather
	 * than an interface, since {@link Input.Props} itself resolves through a
	 * conditional type that an `interface extends` clause can't statically
	 * extend. Pass `list` with the id of the paired `<datalist>` to associate
	 * this control with its suggested values, the same way it would on a bare
	 * `<input>`.
	 */
	export type InputProps = Input.Props;

	/**
	 * Every native `<button>` attribute except `children`, which stays fixed to
	 * this button's own disclosure glyph, plus the `mix` passthrough. `type`
	 * defaults to {@link DEFAULT_BUTTON_TYPE}.
	 */
	export interface ButtonProps extends Omit<TagProps<"button">, "children"> {}
}

/**
 * Renders a plain host stacking this control's compound parts in a single
 * column with a small gap between them: typically a caption, the
 * {@link ComboBox.Group} row, a paired `<datalist>` of suggested values, and
 * any supporting or validation copy. The `<datalist>` and its `<option>`s
 * compose directly as ordinary markup — the browser owns their rendering and
 * filtering entirely, wired to {@link ComboBox.Input} through that control's
 * own `list` attribute.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <ComboBox>
 * 	<Label htmlFor="fruit">{t("form.fruit.label")}</Label>
 * 	<ComboBox.Group>
 * 		<ComboBox.Input id="fruit" name="fruit" list="fruit-options" />
 * 		<ComboBox.Button aria-label={t("form.fruit.toggle")} />
 * 	</ComboBox.Group>
 * 	<datalist id="fruit-options">
 * 		<option value="Apple" />
 * 		<option value="Banana" />
 * 	</datalist>
 * </ComboBox>
 */
export function ComboBox(handle: Handle<ComboBox.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} data-slot="combobox" mix={[vstack({ gap: 1 }), mix]} />;
	};
}

/**
 * Renders {@link ComboBox}'s control row: a plain flex host laying
 * {@link ComboBox.Input} and {@link ComboBox.Button} out side by side, with
 * the button pulled back over the input's reserved trailing padding so the
 * two read as one seamless field.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <ComboBox.Group>
 * 	<ComboBox.Input id="fruit" list="fruit-options" />
 * 	<ComboBox.Button aria-label={t("form.fruit.toggle")} />
 * </ComboBox.Group>
 */
ComboBox.Group = function ComboBoxGroup(handle: Handle<ComboBox.GroupProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} data-slot="combobox-group" mix={[hstack({ align: "center" }), mix]} />;
	};
};

/**
 * Renders {@link ComboBox}'s text control: an {@link Input} that grows to
 * fill its row and reserves inline-end padding for {@link ComboBox.Button}'s
 * overlapping glyph. Every {@link Input} state — hover, focus, focus-visible,
 * invalid, disabled — carries over unchanged, since this control renders an
 * {@link Input} underneath rather than a bare `<input>`. Pass `list` with the
 * id of a paired `<datalist>` to wire this control to its suggested values,
 * and a companion behavior can read the typed value to narrow which
 * `<option>`s that `<datalist>` shows as the reader types.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <ComboBox.Input id="fruit" name="fruit" list="fruit-options" />
 * @example
 * <ComboBox.Input aria-label={t("form.country.label")} color="primary" list="country-options" />
 */
ComboBox.Input = function ComboBoxInput(handle: Handle<ComboBox.InputProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <Input {...rest} mix={[spacer(), pie(9), mix]} />;
	};
};

/**
 * Renders {@link ComboBox}'s trailing disclosure glyph: a native `<button>`
 * pulled back over {@link ComboBox.Input}'s reserved trailing padding so it
 * reads as part of the same field. Its content is fixed to a chevron glyph
 * marked `aria-hidden`, since this button carries no visible text of its own.
 * Hover reads this host's own native `:hover` pseudo-class, and a keyboard
 * focus-visible ring reads in the semantic primary tone.
 *
 * In dev mode, a button with no `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no accessible name
 * to announce for it.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the button's markup.
 * @example
 * <ComboBox.Button aria-label={t("form.fruit.toggle")} />
 */
ComboBox.Button = function ComboBoxButton(handle: Handle<ComboBox.ButtonProps>) {
	return () => {
		let { type, mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			"ComboBox.Button: this button needs an `aria-label` describing what it does — its content is a decorative glyph with no accessible name of its own.",
		);

		return (
			<button
				type={type ?? DEFAULT_BUTTON_TYPE}
				{...rest}
				mix={[
					interactiveTransition(),
					center(),
					is("1.75rem"),
					bs("1.75rem"),
					rounded("sm"),
					fg("neutral"),
					when("& svg", [is("1rem"), bs("1rem")]),
					when("&:hover", bg("neutral.bg-tint-hover")),
					when("&:focus-visible", outline({ color: "primary.ring", offset: 0 })),
					mis("-2rem"),
					mix,
				]}
			>
				<ChevronDownIcon aria-hidden />
			</button>
		);
	};
};
