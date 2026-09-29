/**
 * The index a catalogue package answers with in place of its README: hundreds of
 * entries as ruled grids of names under the group each belongs to. A cell holds the name
 * alone — with three hundred entries, a name is what a reader scans for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, textTransform, tracking } from "@sdxc/u/typography";

import type { NavEntry, NavGroup } from "~/app/services/navigation-tree";

import RuledGrid, { RuledCell } from "~/resources/components/ruled-grid";

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

/** Renders one catalogue's whole index, each band as a ruled grid of names. */
export default function CatalogueIndex(handle: Handle<CatalogueIndex.Props>) {
	return () => {
		return (
			<div mix={[vstack({ gap: 10, align: "stretch" })]}>
				{bands(handle.props.groups).map((group) => (
					<section key={group.title} mix={[vstack({ gap: 4, align: "stretch" })]}>
						{group.title ? (
							<h2
								mix={[
									m(0),
									font("mono"),
									text("xs"),
									textTransform("uppercase"),
									tracking("widest"),
									fg("neutral"),
								]}
							>
								{group.title}
							</h2>
						) : null}

						<RuledGrid min="11rem">
							{group.entries.map((entry) => (
								<RuledCell key={entry.href} href={entry.href} name={entry.title} />
							))}
						</RuledGrid>
					</section>
				))}
			</div>
		);
	};
}
