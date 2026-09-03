/**
 * A single-line search field: a `<search>` landmark stacking a caption, a
 * decorated control, and optional supporting or validation copy, composed
 * from whatever compound parts a given field needs. Its own
 * {@link SearchField.Input} part pairs a leading glyph with the native
 * `<input type="search">` control it decorates, building on {@link Input} for
 * that control's box, color, and state styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { SearchIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { pointerEvents } from "@sdxc/u/general";
import { absolute, flex, insIs, items, relative } from "@sdxc/u/layout";
import { pis } from "@sdxc/u/size";

import { fieldStackLayout } from "../styles/field-stack-layout";

import { Input } from "./input";

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
				<Input type="search" {...rest} mix={[pis("2.25rem"), mix]} />
			</div>
		);
	};
};
