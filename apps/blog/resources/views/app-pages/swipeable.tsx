/**
 * A row of cards that scrolls sideways one card at a time on a narrow screen and sits whole as
 * a grid once it fits, shared by the app landings for their screens, steps and cards. Its
 * fade follows the scroll through the swipe-fade island and degrades to a plain row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { gap, grid } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";

import { SwipeFade } from "~/resources/components/swipe-fade";

namespace Swipeable {
	/** Props of a row that scrolls sideways. */
	export interface Props {
		/** Names the list for assistive technology. */
		label: string;
		/**
		 * Each item's width while the row scrolls, in `cqi` of the row: most of it so one card
		 * reads at a time, and no wider than its content so cards sit the row's gap apart.
		 */
		column: string;
		/** The row's width from which every item fits and the row stops scrolling. */
		fitsFrom?: string;
		/** Each item's width once they all fit. Defaults to `column`. */
		fitColumn?: string;
		/** The row's `li` items. */
		children: RemixNode;
	}
}

/**
 * The fade a row's mask draws for each pair of edges with cards past them, each as wide as
 * the gutter `peek` leaves beside the centred card, so only the neighbours ever fade.
 */
function fades(peek: string) {
	return {
		end: `linear-gradient(to right, black calc(100% - ${peek}), transparent)`,
		start: `linear-gradient(to right, transparent, black ${peek})`,
		both: `linear-gradient(to right, transparent, black ${peek}, black calc(100% - ${peek}), transparent)`,
	};
}

/**
 * A row of cards that scrolls sideways one card at a time: each card is most of the row's
 * width and snaps to its centre, so one card is readable and its neighbours peek in the
 * equal gutters at either edge, all a fade ever covers. The row is its own size container,
 * so its gutters and `fitsFrom` measure the row; from `fitsFrom` it becomes a grid.
 *
 * @param handle Runtime handle carrying the label, the item widths and the items.
 * @returns The render function producing the row.
 */
export function Swipeable(handle: Handle<Swipeable.Props>) {
	return () => {
		let { children, column, fitColumn, fitsFrom, label } = handle.props;
		let fits = fitsFrom ? `@container (min-width: ${fitsFrom})` : undefined;
		let peek = `calc((100cqi - ${column}) / 2)`;
		let fade = fades(peek);
		return (
			<div mix={[raw({ containerType: "inline-size" })]}>
				<ul
					aria-label={label}
					data-swipe=""
					mix={[
						grid(),
						gap(4),
						m(0),
						p(0),
						raw({
							listStyle: "none",
							gridAutoFlow: "column",
							gridAutoColumns: column,
							overflowX: "auto",
							scrollSnapType: "x mandatory",
							paddingBlockEnd: "0.5rem",
							paddingInline: peek,
							"& > li": { scrollSnapAlign: "center" },
							maskImage: fade.end,
							'&[data-fade="start"]': { maskImage: fade.start },
							'&[data-fade="both"]': { maskImage: fade.both },
							'&[data-fade="none"]': { maskImage: "none" },
							...(fits
								? {
										[fits]: {
											maskImage: "none",
											overflowX: "visible",
											paddingInline: "0",
											gridAutoColumns: fitColumn ?? column,
										},
									}
								: {}),
						}),
					]}
				>
					{children}
				</ul>
				<SwipeFade />
			</div>
		);
	};
}
