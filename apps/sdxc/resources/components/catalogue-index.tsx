/**
 * The index a catalogue package answers with in place of its README: hundreds of
 * entries as a plain list of links under the group each belongs to. It stays
 * unadorned on purpose — with three hundred entries a grid of cards is slower to scan
 * than a column of names, not faster.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, pis } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, tracking, weight } from "@sdxc/u/typography";

import type { NavEntry, NavGroup } from "~/app/services/navigation-tree";

namespace CatalogueIndex {
	export interface Props {
		/**
		 * The catalogue's entries. A catalogue whose names carry a grouping arrives banded
		 * by it; one whose names carry none arrives as a single run and is drawn without a
		 * heading, since a lone heading would only repeat the page's own title.
		 */
		groups: NavGroup[] | NavEntry[];
	}
}

/** Reads either shape as the bands to draw, with an untitled band for a flat list. */
function bands(groups: NavGroup[] | NavEntry[]): NavGroup[] {
	let [first] = groups;
	if (first === undefined) return [];
	if ("entries" in first) return groups as NavGroup[];
	return [{ title: "", entries: groups as NavEntry[] }];
}

/** Renders one catalogue's whole index. */
export default function CatalogueIndex(handle: Handle<CatalogueIndex.Props>) {
	return () => {
		return (
			<div mix={[vstack({ gap: 8, align: "stretch" })]}>
				{bands(handle.props.groups).map((group) => (
					<section key={group.title} mix={[vstack({ gap: 3, align: "stretch" })]}>
						{group.title ? (
							<h2 mix={[m(0), text("lg"), weight("semibold"), tracking("tight")]}>{group.title}</h2>
						) : null}

						<ul
							mix={[
								m(0),
								pis(0),
								listStyle("none"),
								grid(),
								gap(2),
								gridTemplate({ columns: repeat(2, 1) }),
								media("(min-width: 48rem)", gridTemplate({ columns: repeat(4, 1) })),
							]}
						>
							{group.entries.map((entry) => (
								<li key={entry.href}>
									<a
										href={entry.href}
										mix={[
											font("mono"),
											text("sm"),
											fg("brand"),
											when("&:hover", fg("brand.emphasis")),
										]}
									>
										{entry.title}
									</a>
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		);
	};
}
