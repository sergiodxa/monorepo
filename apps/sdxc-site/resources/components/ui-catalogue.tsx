/**
 * The body of the `@sdxc/ui` overview under the hero: the component gallery as a grid of
 * tiles, then each subpath as a dense name index. The two shapes stay distinct so the
 * landing does not read as one spreadsheet with longer cells.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "sdxc/u/color";
import { vstack } from "sdxc/u/layout";
import { m } from "sdxc/u/size";
import { font, text, textTransform, tracking } from "sdxc/u/typography";

import type { NavEntry, NavGroup } from "~/app/services/navigation-tree";

import CatalogueIndex from "~/resources/components/catalogue-index";
import UiComponentGrid from "~/resources/components/ui-component-grid";

namespace UiCatalogue {
	export interface Props {
		/** Components drawn as gallery tiles. */
		components: NavEntry[];
		/** Mixins, behaviors, animations and styles as dense name grids. */
		exports: NavGroup[];
	}
}

/** Renders the component gallery and the subpath indexes under it. */
export default function UiCatalogue(handle: Handle<UiCatalogue.Props>) {
	return () => {
		let { components, exports: exportGroups } = handle.props;

		return (
			<div mix={[vstack({ gap: 12, align: "stretch" })]}>
				<section id="components" mix={[vstack({ gap: 5, align: "stretch" })]}>
					<div mix={[vstack({ gap: 2, align: "start" })]}>
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
							Components
						</h2>
						<p mix={[m(0), text("sm"), fg("neutral")]}>
							Every pattern in the catalogue — open one for its reference and live preview.
						</p>
					</div>

					<UiComponentGrid entries={components} />
				</section>

				<CatalogueIndex groups={exportGroups} />
			</div>
		);
	};
}
