/**
 * The body of the `@sdxc/ui` overview under the hero: the component gallery as a
 * grid of tiles, then each subpath as a visual catalogue — live animations,
 * style wireframes, mixin schematics and behavior diagrams — so the landing
 * never collapses into a dense sheet of names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, textTransform, tracking } from "@sdxc/u/typography";

import type { NavEntry, NavGroup } from "~/app/services/navigation-tree";
import type { UiSubpath } from "~/app/services/ui-subpaths";

import { UI_SUBPATH_TITLES, UI_SUBPATHS } from "~/app/services/ui-subpaths";
import UiComponentGrid from "~/resources/components/ui-component-grid";
import UiExportGrid from "~/resources/components/ui-export-grid";

namespace UiCatalogue {
	export interface Props {
		/** Components drawn as gallery tiles. */
		components: NavEntry[];
		/** Mixins, behaviors, animations and styles as visual catalogues. */
		exports: NavGroup[];
	}
}

/** Blurb under each subpath heading describing how that catalogue is shown. */
const SUBPATH_LEADS: Record<UiSubpath, string> = {
	mixins: "Composable behaviour on a host — each tile sketches what the mixin does.",
	behaviors: "Session and model classes as state machines.",
	animations: "Motion factories running live in the tile.",
	styles: "Layout and chrome recipes as wireframes.",
};

/** Resolves a catalogue band title back to the subpath it documents. */
function subpathForTitle(title: string): UiSubpath | null {
	let match = UI_SUBPATHS.find((subpath) => UI_SUBPATH_TITLES[subpath] === title);
	return match ?? null;
}

/** Renders the component gallery and the visual export catalogues under it. */
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

				{exportGroups.map((group) => {
					let subpath = subpathForTitle(group.title);
					if (!subpath) return null;

					return (
						<section key={group.title} id={subpath} mix={[vstack({ gap: 5, align: "stretch" })]}>
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
									{group.title}
								</h2>
								<p mix={[m(0), text("sm"), fg("neutral")]}>{SUBPATH_LEADS[subpath]}</p>
							</div>

							<UiExportGrid subpath={subpath} entries={group.entries} />
						</section>
					);
				})}
			</div>
		);
	};
}
