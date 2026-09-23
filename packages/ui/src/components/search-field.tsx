/**
 * A single-line search field: a `<search>` landmark stacking a caption, a
 * decorated control, and optional supporting or validation copy, composed
 * from whatever compound parts a given field needs. Its own
 * {@link SearchField.Input} part pairs a leading glyph with the native
 * `<input type="search">` control it decorates, building on {@link Input} for
 * that control's box, color, and state styling, and
 * {@link SearchField.Control} rows that input with the
 * {@link SearchField.Clear} button that empties it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { SearchIcon, XIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { pointerEvents } from "@sdxc/u/general";
import {
	absolute,
	appearance,
	flex,
	grow,
	hidden,
	insBs,
	insIe,
	insIs,
	items,
	relative,
} from "@sdxc/u/layout";
import { bs, is, p, pis } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { translateY } from "@sdxc/u/transform";

import { clearField, SEARCH_FIELD_CLEAR_COMMAND } from "../mixins/clear-field.js";
import { fieldStackLayout } from "../styles/field-stack-layout.js";

import { Button } from "./button.js";
import { Input } from "./input.js";

/**
 * Prop types for {@link SearchField} and its compound parts.
 */
export namespace SearchField {
	/**
	 * Every native `<search>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` composes this field's parts — typically a caption, the
	 * {@link SearchField.Input} control, and validation copy — in a single column.
	 */
	export interface Props extends TagProps<"search"> {
		/** The field's compound parts: a caption, the control, and any supporting or validation copy. */
		children: RemixNode;
	}

	/**
	 * Every prop {@link Input} accepts except `type`, `list`, and `role`,
	 * which this control fixes to `"search"` and the platform's own implicit
	 * `searchbox` role on the consumer's behalf, plus the `mix` passthrough.
	 */
	export interface InputProps extends Omit<Input.Props, "type" | "list" | "role"> {}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` holds one control row: the {@link SearchField.Input} and the
	 * {@link SearchField.Clear} button that empties it.
	 */
	export interface ControlProps extends TagProps<"div"> {
		/** The row's contents: the search input, and the clear button reading it. */
		children: RemixNode;
	}

	/**
	 * Every prop {@link Button} accepts except `type`, `variant`, `size`, and
	 * `command`, which this control fixes on the consumer's behalf, plus the
	 * `mix` passthrough.
	 */
	export interface ClearProps extends Omit<
		Button.Props,
		"type" | "variant" | "size" | "command" | "children"
	> {
		/** The `id` of the input this button empties, naming the control it belongs to. */
		commandfor: string;
		/** Glyph or label the button shows. Defaults to a decorative {@link XIcon}. */
		children?: RemixNode;
	}
}

/**
 * Renders a `<search>` landmark — the platform's own role for a search
 * region, needing no explicit `role` attribute — stacking a caption,
 * {@link SearchField.Input}, and validation copy in a single column.
 *
 * @param handle Runtime handle carrying the host `<search>`'s props.
 * @returns The render function producing the field's markup.
 * @example
 * <SearchField>
 * 	<Label htmlFor="site-search">{t("search.label")}</Label>
 * 	<SearchField.Input id="site-search" name="q" placeholder={t("search.placeholder")} />
 * </SearchField>
 * @example
 * <SearchField aria-label={t("search.label")}>
 * 	<SearchField.Input name="q" />
 * </SearchField>
 */
export function SearchField(handle: Handle<SearchField.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <search {...rest} data-slot="search-field" mix={[fieldStackLayout(), mix]} />;
	};
}

/**
 * Renders {@link SearchField}'s control: a positioning wrapper pairing a
 * muted, decorative {@link SearchIcon} with a native `<input type="search">`
 * built on {@link Input}, inheriting its box, color, and state styling.
 *
 * The user agent's own cancel affordance is suppressed, so clearing the field is
 * {@link SearchField.Clear}'s job — one glyph the field styles and places, sitting
 * alone in the trailing corner.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <SearchField.Input aria-label={t("search.label")} placeholder={t("search.placeholder")} />
 * @example
 * <SearchField.Input name="q" color="brand" defaultValue="remix" />
 */
SearchField.Input = function SearchFieldInput(handle: Handle<SearchField.InputProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div data-slot="input-wrapper" mix={[relative(), flex(), items("center")]}>
				<SearchIcon
					size={16}
					data-slot="icon"
					mix={[absolute(), insIs("0.75rem"), pointerEvents(), fg("neutral.muted")]}
				/>
				<Input
					type="search"
					{...rest}
					mix={[
						pis("2.25rem"),
						/*
						 * The field owns its own chrome, and {@link SearchField.Clear} draws the
						 * clear affordance. The user agent draws one of its own inside a search
						 * input that holds a value, unstyled and in the same corner, so the two
						 * would sit on top of each other.
						 */
						when("&::-webkit-search-cancel-button", [appearance("none"), hidden()]),
						when("&::-webkit-search-decoration", [appearance("none"), hidden()]),
						mix,
					]}
				/>
			</div>
		);
	};
};

/**
 * Renders the row holding {@link SearchField.Input} and the
 * {@link SearchField.Clear} button beside it, and the positioning context that
 * anchors the clear button to the input's trailing edge.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the control row's markup.
 * @example
 * <SearchField.Control>
 * 	<SearchField.Input id="site-search" name="q" />
 * 	<SearchField.Clear commandfor="site-search" aria-label={t("search.clear")} />
 * </SearchField.Control>
 */
SearchField.Control = function SearchFieldControl(handle: Handle<SearchField.ControlProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="control"
				mix={[
					relative(),
					flex(),
					items("center"),
					/* The input spans the row, so the field keeps the width its container offers. */
					when('& > [data-slot="input-wrapper"]', grow()),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link SearchField}'s clear button: a round, icon-sized ghost
 * {@link Button} centred on the input's trailing edge, carrying `clearField()`
 * so it empties the `commandfor` input it names and shows while that input holds text.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the clear button's markup.
 * @example
 * <SearchField.Clear commandfor="site-search" aria-label={t("search.clear")} />
 * @example
 * <SearchField.Clear commandfor="site-search">{t("search.clear")}</SearchField.Clear>
 */
SearchField.Clear = function SearchFieldClear(handle: Handle<SearchField.ClearProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<Button
				type="button"
				{...rest}
				hidden
				variant="ghost"
				size="sm"
				command={SEARCH_FIELD_CLEAR_COMMAND}
				data-slot="clear"
				mix={[
					clearField(),
					/*
					 * A round, icon-sized target centred on the field, so its hover tint reads as a
					 * disc beside the text, and its glyph sits as far from the trailing edge as the
					 * search glyph sits from the leading one.
					 */
					is(7),
					bs(7),
					p(0),
					rounded("full"),
					absolute(),
					insIe("0.375rem"),
					insBs("50%"),
					translateY("-50%"),
					mix,
				]}
			>
				{children ?? <XIcon size={16} />}
			</Button>
		);
	};
};
