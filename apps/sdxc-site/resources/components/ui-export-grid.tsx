/**
 * Explorer grid for one `@sdxc/ui` export subpath: spaced tiles with live or
 * diagram faces, sized so about three sit across the article measure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { listStyle, raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, repeat } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";

import type { NavEntry } from "~/app/services/navigation-tree";
import type { UiSubpath } from "~/app/services/ui-subpaths";

import UiExportCard from "~/resources/components/ui-export-card";

/** Narrowest an export tile may get before the grid drops a column. */
const CARD_MIN = "14rem";

namespace UiExportGrid {
	export interface Props {
		subpath: UiSubpath;
		entries: NavEntry[];
	}
}

/**
 * Renders the explorer tiles for one export subpath. Carries `data-slot` so
 * DocsLayout leaves the list at the article measure.
 */
export default function UiExportGrid(handle: Handle<UiExportGrid.Props>) {
	return () => (
		<ul
			data-slot="ui-export-grid"
			mix={[
				grid(),
				m(0),
				p(0),
				listStyle("none"),
				gap(4),
				gridTemplate({
					columns: repeat("auto-fill", `minmax(min(100%, ${CARD_MIN}), 1fr)`),
				}),
				raw({ alignItems: "stretch", maxInlineSize: "none" }),
			]}
		>
			{handle.props.entries.map((entry) => (
				<UiExportCard
					key={entry.href}
					href={entry.href}
					name={entry.title}
					subpath={handle.props.subpath}
				/>
			))}
		</ul>
	);
}
