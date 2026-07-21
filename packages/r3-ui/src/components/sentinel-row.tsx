/**
 * A decorative sentinel row shared by every list-shaped compound component
 * that renders a trailing loading placeholder: a `<div>` styled as centered,
 * muted small text, sized to match its enclosing list's own row rhythm.
 * Every compound component that trails its rows with one assigns this same
 * implementation to its own part rather than declaring an independent copy,
 * since the markup, styling, and behavior a sentinel row needs never varies
 * by which list it trails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { css } from "remix/ui";

/**
 * Renders a decorative sentinel row: a `<div>` styled as centered, muted
 * small text. Carries no loading or fetching behavior of its own — it is
 * styling only, ready to hold whatever loading indicator or "load more"
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
					css({
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						paddingBlock: "0.5rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						color: "var(--ui-neutral-fg-muted)",
					}),
					mix,
				]}
			/>
		);
	};
}
