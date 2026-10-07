/**
 * The search field the search panel and the `/search` page share: a magnifier (or whatever
 * leads the row) beside a large, borderless `type="search"` input. The surface around it
 * shows where the field is and that it has focus, so the input draws no box or ring.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { SearchIcon } from "@sdxc/icons";
import { bg, border, fg, outlineStyle } from "@sdxc/u/color";
import {
	appearance,
	gap,
	grid,
	gridTemplate,
	hidden,
	inlineFlex,
	items,
	shrink,
} from "@sdxc/u/layout";
import { bs, is, m, minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

/** Prop types for {@link QuietSearchInput} and {@link QuietSearchRow}. */
export namespace QuietSearchInput {
	/** Every `<input>` attribute; a caller passes `type="search"`. */
	export type Props = TagProps<"input">;

	export interface RowProps {
		/** What leads the row; the magnifier when left out. */
		lead?: RemixNode;
		/** The input, then anything that trails it, such as a Cancel button. */
		children: RemixNode;
		mix?: TagProps<"div">["mix"];
	}
}

/**
 * The input itself: large text, no border, no background and no outline of its own, so it
 * reads as part of the surface it sits on.
 */
export function QuietSearchInput(handle: Handle<QuietSearchInput.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<input
				{...rest}
				mix={[
					minIs(0),
					bs(14),
					m(0),
					p(0),
					border("none"),
					bg("transparent"),
					fg("neutral.emphasis"),
					text("xl"),
					outlineStyle("none"),
					appearance("none"),
					when("&::placeholder", fg("neutral.muted")),
					when("&::-webkit-search-decoration", [appearance("none"), hidden()]),
					mix,
				]}
			/>
		);
	};
}

/**
 * The row the input sits in: the lead (a magnifier by default) in a fixed slot, the input
 * taking the rest, and any trailing control after it.
 */
export function QuietSearchRow(handle: Handle<QuietSearchInput.RowProps>) {
	return () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: "auto minmax(0, 1fr) auto" }),
				items("center"),
				gap(3),
				fg("neutral.muted"),
				text("xl"),
				handle.props.mix,
			]}
		>
			<span mix={[inlineFlex(), items("center"), is(6), bs(6)]}>
				{handle.props.lead ?? <SearchIcon size="1em" mix={[shrink(0)]} />}
			</span>
			{handle.props.children}
		</div>
	);
}
