/**
 * The sidebars the documentation reads in: the guides under `/docs`, the package
 * reference under `/api`, and one each for the two catalogues. The tree a page draws and
 * the pager that steps between its pages are both built from here, so the two always
 * agree on what comes next.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NavEntry, NavGroup, NavTree } from "~/app/services/navigation-tree";

import { listComponents } from "~/app/services/components";
import { listGuides } from "~/app/services/docs";
import { listPackageGroups } from "~/app/services/packages";
import { listUiExports } from "~/app/services/ui-exports";
import { UI_SUBPATH_TITLES, UI_SUBPATHS } from "~/app/services/ui-subpaths";
import { listUtilityFamilies } from "~/app/services/utilities";
import routes from "~/routes/web";

/** The section the changelog is read under, which the guides beside it already declare. */
const RELEASES_SECTION = "Releases";

/**
 * The packages whose reference is a catalogue of hundreds of pages. Each draws its own
 * sidebar under `/api/<name>`, so the package sidebar leaves them out.
 */
export const CATALOGUE_PACKAGES = new Set(["u", "ui"]);

/**
 * The guides, under the sections their frontmatter files them in. Every builder here
 * reads per call, because work in the worker's global scope fails upload validation.
 */
export async function buildGuidesNav(): Promise<NavTree> {
	let sections = await listGuides();

	return {
		label: "Documentation",
		href: routes.docs.index.href(),
		sections: sections.map((section) => {
			let entries = section.guides.map((guide) => ({
				title: guide.frontmatter.title,
				href: routes.docs.show.href({ slug: guide.slug }),
			}));

			/* The changelog reads GitHub rather than a file, so it joins here rather than there. */
			if (section.title === RELEASES_SECTION) {
				entries.push({ title: "Changelog", href: routes.docs.changelog.href() });
			}

			return { title: section.title, entries, groups: [] };
		}),
	};
}

/** Every package but the two catalogues, under the group the taxonomy files it in. */
export async function buildPackagesNav(): Promise<NavTree> {
	let groups = listPackageGroups().map((group) => ({
		title: group.title,
		entries: group.packages
			.filter((entry) => !CATALOGUE_PACKAGES.has(entry.directory))
			.map((entry) => ({
				title: entry.name,
				href: routes.api.show.href({ name: entry.directory }),
			})),
		groups: [],
	}));

	return {
		label: "API",
		href: routes.api.index.href(),
		sections: [
			{
				title: "Packages",
				entries: [{ title: "Every package", href: routes.api.index.href() }],
				groups: [],
			},
			...groups.filter((group) => group.entries.length > 0),
		],
	};
}

/** The `@sdxc/u` catalogue, each utility under the subpath it is imported from. */
export async function buildUtilitiesNav(): Promise<NavTree> {
	return {
		label: "@sdxc/u",
		href: routes.api.show.href({ name: "u" }),
		sections: [
			{
				title: "@sdxc/u",
				entries: [{ title: "Overview", href: routes.api.show.href({ name: "u" }) }],
				groups: [],
			},
			{ title: "Utilities", entries: [], groups: await listUtilityGroups() },
		],
	};
}

/**
 * The `@sdxc/ui` catalogue: the theme contract ahead of the components that read it,
 * then each subpath the components are built from, under the name it is imported by.
 */
export async function buildComponentsNav(): Promise<NavTree> {
	return {
		label: "@sdxc/ui",
		href: routes.api.show.href({ name: "ui" }),
		sections: [
			{
				title: "@sdxc/ui",
				entries: [
					{ title: "Overview", href: routes.api.show.href({ name: "ui" }) },
					{ title: "Theming", href: routes.api.component.href({ component: "theming" }) },
				],
				groups: [],
			},
			{ title: "Components", entries: await listComponentEntries(), groups: [] },
			...(await listUiExportGroups()).map((group) => ({ ...group, groups: [] })),
		],
	};
}

/**
 * The sidebar a package's page draws: a catalogue's own, or the package sidebar for
 * every other package, including a name that matches none.
 */
export async function buildPackageNav(name: string): Promise<NavTree> {
	if (name === "u") return await buildUtilitiesNav();
	if (name === "ui") return await buildComponentsNav();
	return await buildPackagesNav();
}

/** Each utility family as one collapsible group, named after the subpath it is imported from. */
export async function listUtilityGroups(): Promise<NavGroup[]> {
	let families = await listUtilityFamilies();

	return families.map((family) => ({
		title: family.name,
		entries: family.utilities.map((utility) => ({
			title: utility.name,
			href: routes.api.utility.href({ utility: utility.name }),
		})),
	}));
}

/**
 * Every component as one list. The names are already alphabetical and share a flat
 * namespace, so a reader scans them the way they would scan an index.
 */
export async function listComponentEntries(): Promise<NavEntry[]> {
	let components = await listComponents();

	return components.map((entry) => ({
		title: entry.name,
		href: routes.api.component.href({ component: entry.slug }),
	}));
}

/** Each `@sdxc/ui` subpath beside the components as one group, in the order they are taught. */
export async function listUiExportGroups(): Promise<NavGroup[]> {
	return await Promise.all(
		UI_SUBPATHS.map(async (subpath) => ({
			title: UI_SUBPATH_TITLES[subpath],
			entries: (await listUiExports(subpath)).map((entry) => ({
				title: entry.name,
				href: routes.api.uiExport.href({ subpath, slug: entry.slug }),
			})),
		})),
	);
}

export type { NavEntry, NavGroup, NavSection, NavTree } from "~/app/services/navigation-tree";
export { findNeighbours, flattenNav } from "~/app/services/navigation-tree";
