/**
 * Every `@sdxc/ui` reference page as one list — the theme contract, each component and
 * each subpath export — with the markdown twin each one answers on. The search index,
 * `/llms.txt`, the sitemap and the MCP resources all enumerate the catalogue through here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UiSubpath } from "~/app/services/ui-subpaths";

import { listComponents, readComponent } from "~/app/services/components";
import { readTheme } from "~/app/services/theming";
import { listUiExports, readUiExport } from "~/app/services/ui-exports";
import {
	componentMarkdown,
	THEMING_SUMMARY,
	THEMING_TITLE,
	themeMarkdown,
	uiExportMarkdown,
} from "~/app/services/ui-markdown";
import { isUiSubpath, UI_SUBPATH_TITLES, UI_SUBPATHS } from "~/app/services/ui-subpaths";
import routes from "~/routes/web";

/** Where the package's sources are read on GitHub, which every page's `Open` menu links. */
export const UI_SOURCE_BASE = "https://github.com/sergiodxa/monorepo/blob/main/packages/ui/src/";

/** The one segment under the component tree that is a page rather than a component. */
export const THEMING_SLUG = "theming";

/** One reference page of the catalogue, as a listing or an index names it. */
export interface UiPage {
	title: string;
	/** The band it is listed under: `Components`, `Mixins`, `Behaviors` and so on. */
	section: string;
	/** The subpath an export imports from; `null` for the theme contract and a component. */
	subpath: UiSubpath | null;
	summary: string;
	href: string;
	/** The page's `.md` twin, which is what an agent reads it from. */
	markdownHref: string;
}

/**
 * Every page, in the order the sidebar lists them: the theme contract and the components,
 * then each subpath's exports.
 */
export async function listUiPages(): Promise<UiPage[]> {
	let pages: UiPage[] = [
		{
			title: THEMING_TITLE,
			section: "Components",
			subpath: null,
			summary: THEMING_SUMMARY,
			href: routes.api.component.href({ component: THEMING_SLUG }),
			markdownHref: routes.markdown.component.href({ component: THEMING_SLUG }),
		},
	];

	for (let entry of await listComponents()) {
		let reference = await readComponent(entry.slug);
		pages.push({
			title: entry.name,
			section: "Components",
			subpath: null,
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
				section: UI_SUBPATH_TITLES[subpath],
				subpath,
				summary: reference?.summary ?? "",
				href: routes.api.uiExport.href({ subpath, slug: entry.slug }),
				markdownHref: routes.markdown.uiExport.href({ subpath, slug: entry.slug }),
			});
		}
	}

	return pages;
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
