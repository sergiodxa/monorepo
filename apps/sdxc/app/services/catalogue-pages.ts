/**
 * Every page of the two catalogues as one list — each `@sdxc/u` utility, then the
 * `@sdxc/ui` theme contract, components and subpath exports — with the markdown twin
 * each one answers on. Search, `/llms.txt`, the sitemap and the MCP resources all
 * enumerate the catalogues through here, so a page added to either reaches all four.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	componentMarkdown,
	THEMING_SUMMARY,
	THEMING_TITLE,
	themeMarkdown,
	uiExportMarkdown,
	utilityMarkdown,
} from "~/app/services/catalogue-markdown";
import { listComponents, readComponent } from "~/app/services/components";
import { readTheme } from "~/app/services/theming";
import { listUiExports, readUiExport } from "~/app/services/ui-exports";
import { isUiSubpath, UI_SUBPATH_TITLES, UI_SUBPATHS } from "~/app/services/ui-subpaths";
import { listUtilityFamilies, readUtility } from "~/app/services/utilities";
import routes from "~/routes/web";

/** Where the packages' sources are read on GitHub, which every page's `Open` menu links. */
export const CATALOGUE_SOURCE_BASE = "https://github.com/sergiodxa/monorepo/blob/main/packages/";

/** The one segment under the component tree that is a page rather than a component. */
export const THEMING_SLUG = "theming";

/** One reference page of a catalogue, as a listing or an index names it. */
export interface CataloguePage {
	title: string;
	/** The package the page documents, as it is imported. */
	package: "@sdxc/u" | "@sdxc/ui";
	/** What the page documents, which is also the MCP resource template it answers on. */
	kind: "utility" | "component" | "export";
	/**
	 * The band it is listed under within its package: a utility family such as `layout`,
	 * or `Components`, `Mixins`, `Behaviors` and so on.
	 */
	section: string;
	summary: string;
	href: string;
	/** The page's `.md` twin, which is what an agent reads it from. */
	markdownHref: string;
}

/**
 * Every page, in the order the sidebars list them: the utilities by family, then the
 * theme contract and the components, then each `@sdxc/ui` subpath's exports.
 */
export async function listCataloguePages(): Promise<CataloguePage[]> {
	let pages: CataloguePage[] = [];

	for (let family of await listUtilityFamilies()) {
		for (let entry of family.utilities) {
			let reference = await readUtility(entry.name);
			let property = reference?.property ?? entry.name;
			pages.push({
				title: property === entry.name ? entry.name : `${property} (${entry.name})`,
				package: "@sdxc/u",
				kind: "utility",
				section: family.name,
				summary: reference?.summary ?? "",
				href: routes.api.utility.href({ utility: entry.name }),
				markdownHref: routes.markdown.utility.href({ utility: entry.name }),
			});
		}
	}

	pages.push({
		title: THEMING_TITLE,
		package: "@sdxc/ui",
		kind: "component",
		section: "Components",
		summary: THEMING_SUMMARY,
		href: routes.api.component.href({ component: THEMING_SLUG }),
		markdownHref: routes.markdown.component.href({ component: THEMING_SLUG }),
	});

	for (let entry of await listComponents()) {
		let reference = await readComponent(entry.slug);
		pages.push({
			title: entry.name,
			package: "@sdxc/ui",
			kind: "component",
			section: "Components",
			summary: reference?.summary ?? "",
			href: routes.api.component.href({ component: entry.slug }),
			markdownHref: routes.markdown.component.href({ component: entry.slug }),
		});
	}

	for (let subpath of UI_SUBPATHS) {
		for (let entry of await listUiExports(subpath)) {
			let reference = await readUiExport(subpath, entry.slug);
			pages.push({
				title: entry.name,
				package: "@sdxc/ui",
				kind: "export",
				section: UI_SUBPATH_TITLES[subpath],
				summary: reference?.summary ?? "",
				href: routes.api.uiExport.href({ subpath, slug: entry.slug }),
				markdownHref: routes.markdown.uiExport.href({ subpath, slug: entry.slug }),
			});
		}
	}

	return pages;
}

/**
 * The markdown twin of a page under `/api/u/:utility`.
 *
 * @param utility - The utility's exported name, as the URL carries it.
 * @returns The page as markdown, or `null` when the catalogue publishes no such name.
 */
export async function readUtilityMarkdown(utility: string): Promise<string | null> {
	let reference = await readUtility(utility);
	return reference === null ? null : utilityMarkdown(reference);
}

/**
 * The markdown twin of a page under `/api/ui/:component`: the theme contract or one
 * component.
 *
 * @param component - The segment the URL carries.
 * @returns The page as markdown, or `null` when nothing is published under that segment.
 */
export async function readComponentMarkdown(component: string): Promise<string | null> {
	if (component === THEMING_SLUG) return themeMarkdown(await readTheme());

	let reference = await readComponent(component);
	return reference === null ? null : componentMarkdown(reference);
}

/**
 * The markdown twin of a page under `/api/ui/:subpath/:slug`.
 *
 * @param subpath - The subpath segment, which may name nothing the package publishes.
 * @param slug - The export's name in kebab case.
 * @returns The page as markdown, or `null` when the subpath publishes no such export.
 */
export async function readUiExportMarkdown(subpath: string, slug: string): Promise<string | null> {
	if (!isUiSubpath(subpath)) return null;

	let reference = await readUiExport(subpath, slug);
	return reference === null ? null : uiExportMarkdown(reference);
}
