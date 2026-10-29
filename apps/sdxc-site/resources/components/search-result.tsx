/**
 * One search match drawn as a row: its kind's icon, the title with its matched words marked,
 * and the page's summary (or, for a heading, the page and section it sits in). The `/search`
 * page and the search dialog both list matches with it, so the two look alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { BlocksIcon, BookOpenIcon, PackageIcon, PaintbrushIcon } from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { gap, grid, gridTemplate, items } from "@sdxc/u/layout";
import { dark, light } from "@sdxc/u/responsive";
import { minIs, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, textDecoration, truncate, weight } from "@sdxc/u/typography";
import { Highlight } from "@sdxc/ui";

import type { SearchKind } from "~/app/services/search-query";
import type { SearchResults } from "~/app/services/search-results";

/** The icon each kind leads its rows and quick link with. */
const KIND_ICONS = {
	guide: BookOpenIcon,
	api: PackageIcon,
	u: PaintbrushIcon,
	ui: BlocksIcon,
};

/** A kind's icon in the brand color, sized to the row's first line. */
export function SearchKindIcon(handle: Handle<{ kind: SearchKind; label?: string }>) {
	return () => {
		let Icon = KIND_ICONS[handle.props.kind];
		let { label } = handle.props;
		return (
			<Icon
				size="1.25rem"
				aria-hidden={label ? undefined : "true"}
				aria-label={label}
				role={label ? "img" : undefined}
				mix={[fg("brand")]}
			/>
		);
	};
}

/** What a result row is given: the match, and its option id inside a listbox. */
interface SearchResultProps {
	item: SearchResults.Item;
	/**
	 * Makes the row an `option` with this id, filled with a rounded tint while hovered or
	 * chosen, so a combobox can point at it; its lines keep to one line each, so every row is
	 * the same height and the dialog's matches fit on screen.
	 */
	optionId?: string;
}

/** Renders a result row; the icon is named for assistive technology, since the kind is news here. */
export function SearchResult(handle: Handle<SearchResultProps>) {
	return () => {
		let { item, optionId } = handle.props;

		return (
			<li
				id={optionId}
				// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- A row is an option of the listbox it sits in, which the box's aria-activedescendant points at.
				role={optionId ? "option" : undefined}
				aria-selected={optionId ? "false" : undefined}
				mix={
					optionId
						? [
								rounded("1.25rem"),
								/** The panel is the lightest neutral in light mode, so a brand wash is what reads on it. */
								hover([light(bg("brand.bg-tint-hover")), dark(bg("neutral.bg-tint-hover"))]),
								when('&[aria-selected="true"]', [
									light(bg("brand.bg-tint-hover")),
									dark(bg("neutral.bg-tint-hover")),
								]),
							]
						: undefined
				}
			>
				<a
					href={item.href}
					mix={[
						grid(),
						gridTemplate({ columns: "1.5rem minmax(0, 1fr)" }),
						items("start"),
						gap(3),
						p(3),
						fg("neutral.emphasis"),
						textDecoration("none"),
					]}
				>
					<SearchKindIcon kind={item.kind} label={item.kindLabel} />
					<span mix={[grid(), gap(0.5), minIs(0)]}>
						<span mix={[text("base"), weight("medium"), optionId ? truncate() : undefined]}>
							<Highlight segments={item.title} />
						</span>
						<span mix={[text("sm"), fg("neutral.muted"), optionId ? truncate() : undefined]}>
							<Highlight segments={item.description} color="neutral" />
						</span>
					</span>
				</a>
			</li>
		);
	};
}
