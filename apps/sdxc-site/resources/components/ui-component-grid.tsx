/**
 * The explorer grid of `@sdxc/ui` components: spaced tiles with a schematic face, rather
 * than the hairline name sheet the other catalogues use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { listStyle, raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, repeat } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";

import type { NavEntry } from "~/app/services/navigation-tree";

import UiComponentCard from "~/resources/components/ui-component-card";

/**
 * Narrowest a component tile may get before the grid drops a column. Sized so the article
 * measure (not the prose measure) fills with several tiles across on a desktop pass.
 */
const CARD_MIN = "11rem";

namespace UiComponentGrid {
	export interface Props {
		entries: NavEntry[];
	}
}

/** The component slug carried as the last segment of its reference href. */
function slugOf(href: string): string {
	return href.split("/").at(-1) ?? "";
}

/**
 * Renders the explorer tiles for one run of components. The list carries a `data-slot` so
 * DocsLayout leaves it at the article measure — a bare `ul` would stop at the prose measure
 * and leave the column empty beside the cards.
 */
export default function UiComponentGrid(handle: Handle<UiComponentGrid.Props>) {
	return () => (
		<ul
			data-slot="ui-component-grid"
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
				<UiComponentCard
					key={entry.href}
					href={entry.href}
					name={entry.title}
					slug={slugOf(entry.href)}
					description={entry.description}
				/>
			))}
		</ul>
	);
}
