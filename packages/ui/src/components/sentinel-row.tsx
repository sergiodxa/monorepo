/**
 * A decorative sentinel row shared by every list-shaped compound component
 * that renders a trailing loading placeholder: a `<div>` styled as centered,
 * muted small text, sized to match its enclosing list's own row rhythm.
 * Every trailing-row part across these compound components assigns this
 * same implementation, keeping the markup, styling, and behavior identical.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@pkg/u/color";
import { flex, items, justify } from "@pkg/u/layout";
import { pb } from "@pkg/u/size";
import { text } from "@pkg/u/typography";

/**
 * Renders a decorative sentinel row: a `<div>` styled as centered, muted
 * small text, ready to hold whatever loading indicator or "load more"
 * trigger a paired enhancement supplies as `children`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the sentinel row's markup.
 * @example
 * <ListBox.LoadMoreItem>{t("list.loadingMore")}</ListBox.LoadMoreItem>
 */
export function SentinelRow(handle: Handle<TagProps<"div">>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					flex(),
					items("center"),
					justify("center"),
					text("sm"),
					pb("0.5rem"),
					fg("neutral.muted"),
					mix,
				]}
			/>
		);
	};
}
