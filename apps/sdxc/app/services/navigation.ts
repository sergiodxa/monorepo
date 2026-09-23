/**
 * The one order the documentation reads in: the guides under their sections, then the
 * packages under their groups, then the two catalogues. The tree the sidebar draws and
 * the pager that steps between pages are both built from here, so the two always agree
 * on what comes next.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NavEntry, NavGroup, NavTree } from "~/app/services/navigation-tree";

import { listComponents } from "~/app/services/components";
import { listGuides } from "~/app/services/docs";
import { listPackageGroups } from "~/app/services/packages";
import { listUtilityFamilies } from "~/app/services/utilities";
import routes from "~/routes/web";

/** The section the changelog is read under, which the guides beside it already declare. */
const RELEASES_SECTION = "Releases";

/**
 * The tree for one request. Both halves are read per call rather than held in a module
 * constant, because work in the worker's global scope fails upload validation.
 */
export async function buildNavTree(): Promise<NavTree> {
	let sections = await listGuides();

	let guides = sections.map((section) => {
		let entries = section.guides.map((guide) => ({
			title: guide.frontmatter.title,
			href: routes.docs.show.href({ slug: guide.slug }),
		}));

		/* The changelog reads GitHub rather than a file, so it joins here rather than there. */
		if (section.title === RELEASES_SECTION) {
			entries.push({ title: "Changelog", href: routes.docs.changelog.href() });
		}

		return { title: section.title, entries };
	});

	let packages = listPackageGroups().map((group) => ({
		title: group.title,
		entries: group.packages.map((entry) => ({
			title: entry.name,
			href: routes.docs.packages.show.href({ name: entry.directory }),
		})),
	}));

	return {
		guides,
		packages,
		utilities: await buildUtilities(),
		components: await buildComponents(),
	};
}

/** Each utility family as one collapsible group, named after the subpath it is imported from. */
async function buildUtilities(): Promise<NavGroup[]> {
	let families = await listUtilityFamilies();

	return families.map((family) => ({
		title: family.name,
		entries: family.utilities.map((utility) => ({
			title: utility.name,
			href: routes.docs.packages.utility.href({ utility: utility.name }),
		})),
	}));
}

/**
 * Every component as one list, theming first because it is what the rest are read
 * against. The names are already alphabetical, so a reader scans them the way they would
 * scan an index.
 */
async function buildComponents(): Promise<NavEntry[]> {
	let components = await listComponents();

	return [
		{
			title: "Theming",
			href: routes.docs.packages.component.href({ component: "theming" }),
		},
		...components.map((entry) => ({
			title: entry.name,
			href: routes.docs.packages.component.href({ component: entry.slug }),
		})),
	];
}

export type { NavEntry, NavGroup, NavTree };
export { findNeighbours, flattenNav } from "~/app/services/navigation-tree";
