/**
 * The explorer grid of `@sdxc/ui` components: spaced tiles with a live preview plane,
 * rather than the hairline name sheet the other catalogues use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { listStyle, raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, repeat } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";

import type { NavEntry } from "~/app/services/navigation-tree";

import { findPreview } from "~/resources/components/preview-registry.server";
import UiComponentCard from "~/resources/components/ui-component-card";
import routes from "~/routes/web";

/** Narrowest a component tile may get before the grid drops a column. */
const CARD_MIN = "14rem";

namespace UiComponentGrid {
	export interface Props {
		entries: NavEntry[];
	}
}

/**
 * The frame URL for one catalogue entry, or `undefined` when the component has no live
 * preview to embed. The slug is the last path segment of its reference href.
 */
function previewSrcFor(href: string): string | undefined {
	let slug = href.split("/").at(-1);
	if (!slug || !findPreview(slug)) return undefined;
	return routes.frames.preview.href({ component: slug });
}

/** Renders the explorer tiles for one run of components. */
export default function UiComponentGrid(handle: Handle<UiComponentGrid.Props>) {
	return () => (
		<ul
			mix={[
				grid(),
				m(0),
				p(0),
				listStyle("none"),
				gap(4),
				gridTemplate({ columns: repeat("auto-fill", `minmax(${CARD_MIN}, 1fr)`) }),
				raw({ alignItems: "stretch" }),
			]}
		>
			{handle.props.entries.map((entry) => (
				<UiComponentCard
					key={entry.href}
					href={entry.href}
					name={entry.title}
					description={entry.description}
					previewSrc={previewSrcFor(entry.href)}
				/>
			))}
		</ul>
	);
}
