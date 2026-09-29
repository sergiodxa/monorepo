/**
 * A grid of cells separated by hairlines, the way the landing rules its claims, for an
 * index of many links. Every cell draws its own outline into a one-pixel gap it shares with
 * its neighbours, so a line is only ever drawn around a cell, and a last row with fewer cells
 * than columns ends where its cells do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, fg, outline } from "@sdxc/u/color";
import { transition } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text } from "@sdxc/u/typography";

namespace RuledGrid {
	export interface Props {
		/** The narrowest a cell may get, which decides how many fit on one row. */
		min: string;
		children: RemixNode;
	}

	export interface CellProps {
		href: string;
		/** The name the cell links, set in the monospace face a reader types it in. */
		name: string;
		/** A line under the name saying what it is, where the index has one. */
		description?: string;
	}
}

/** Renders the grid; its children are {@link RuledCell}s. */
export default function RuledGrid(handle: Handle<RuledGrid.Props>) {
	return () => (
		<ul
			mix={[
				grid(),
				m(0),
				listStyle("none"),
				gap("1px"),
				p("1px"),
				gridTemplate({ columns: repeat("auto-fill", `minmax(${handle.props.min}, 1fr)`) }),
			]}
		>
			{handle.props.children}
		</ul>
	);
}

/** Renders one linked cell of a {@link RuledGrid}. */
export function RuledCell(handle: Handle<RuledGrid.CellProps>) {
	return () => {
		let { description, href, name } = handle.props;

		return (
			<li mix={[raw({ boxShadow: "0 0 0 1px var(--ui-neutral-border)" })]}>
				<a
					href={href}
					mix={[
						vstack({ gap: 1, align: "stretch" }),
						p(description ? 4 : 3, 4),
						transition("background-color"),
						when("&:hover", bg("neutral.tint")),
						when("&:focus-visible", outline({ color: "brand.ring", offset: -2 })),
					]}
				>
					<code mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>{name}</code>
					{description ? <span mix={[text("sm"), fg("neutral")]}>{description}</span> : null}
				</a>
			</li>
		);
	};
}
