/**
 * Every page of the two catalogues as one list — each `@sdxc/u` utility, then the
 * `@sdxc/ui` theme contract, components and subpath exports — with the markdown twin
 * each one answers on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	componentMarkdown,
	MARKETING_FOUNDATIONS_SUMMARY,
	MARKETING_FOUNDATIONS_TITLE,
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
import { listUtilityExamples } from "~/app/services/utility-examples";
import routes from "~/routes/web";

/** Where the packages' sources are read on GitHub, which every page's `Open` menu links. */
export const CATALOGUE_SOURCE_BASE = "https://github.com/sergiodxa/monorepo/blob/main/packages/";

/** The one segment under the component tree that is a page rather than a component. */
export const THEMING_SLUG = "theming";

/** The marketing foundations overview under the same component tree. */
export const MARKETING_FOUNDATIONS_SLUG = "marketing-foundations";

/** One reference page of a catalogue, as a listing or an index names it. */
/** What every catalogue page carries, whichever tree it lives in. */
interface CataloguePageFields {
	title: string;
	/** The package the page documents, as it is imported. */
	package: "@sdxc/u" | "@sdxc/ui";
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

/** An `@sdxc/u` utility's page, at `routes.api.utility`. */
interface UtilityPage extends CataloguePageFields {
	kind: "utility";
	params: { utility: string };
}

/** The theme contract's or a component's page, at `routes.api.component`. */
interface ComponentPage extends CataloguePageFields {
	kind: "component";
	params: { component: string };
}

/** An `@sdxc/ui` subpath export's page, at `routes.api.uiExport`. */
interface ExportPage extends CataloguePageFields {
	kind: "export";
	params: { subpath: string; slug: string };
}

/**
 * One catalogue page. `kind` is also the MCP resource template it answers on, and `params` are
 * what its route builds the page's URL from, so a sitemap lists it through the route table.
 */
export type CataloguePage = UtilityPage | ComponentPage | ExportPage;

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
				params: { utility: entry.name },
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
		params: { component: THEMING_SLUG },
		href: routes.api.component.href({ component: THEMING_SLUG }),
		markdownHref: routes.markdown.component.href({ component: THEMING_SLUG }),
	});

	pages.push({
		title: MARKETING_FOUNDATIONS_TITLE,
		package: "@sdxc/ui",
		kind: "component",
		section: "Components",
		summary: MARKETING_FOUNDATIONS_SUMMARY,
		params: { component: MARKETING_FOUNDATIONS_SLUG },
		href: routes.api.component.href({ component: MARKETING_FOUNDATIONS_SLUG }),
		markdownHref: routes.markdown.component.href({ component: MARKETING_FOUNDATIONS_SLUG }),
	});

	for (let entry of await listComponents()) {
		let reference = await readComponent(entry.slug);
		pages.push({
			title: entry.name,
			package: "@sdxc/ui",
			kind: "component",
			section: "Components",
			summary: reference?.summary ?? "",
			params: { component: entry.slug },
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
				params: { subpath, slug: entry.slug },
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
	if (reference === null) return null;
	return utilityMarkdown(reference, await listUtilityExamples(utility));
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
	if (component === MARKETING_FOUNDATIONS_SLUG) return marketingFoundationsMarkdown();

	let reference = await readComponent(component);
	return reference === null ? null : componentMarkdown(reference);
}

/**
 * The markdown twin of the marketing foundations overview: tokens, factories,
 * and the motion recipe, matching what the HTML page demonstrates.
 */
function marketingFoundationsMarkdown(): string {
	return [
		`# ${MARKETING_FOUNDATIONS_TITLE}`,
		`> ${MARKETING_FOUNDATIONS_SUMMARY}`,
		"",
		"Import the factories from `@sdxc/ui/styles` and the tokens from `@sdxc/ui/theme.css`.",
		"",
		"## Tokens",
		"",
		"| Token | Default |",
		"| --- | --- |",
		"| `--ui-marketing-measure` | `72rem` |",
		"| `--ui-marketing-gutter` | `1rem` (steps to 1.5rem / 2rem via container) |",
		"| `--ui-marketing-section-space` | `6rem` |",
		"| `--ui-marketing-section-space-compact` | `4rem` |",
		"| `--ui-marketing-section-space-hero` | `8rem` |",
		"| `--ui-marketing-display-tracking` | `-0.04em` |",
		"| `--ui-marketing-display-weight` | `500` |",
		"| `--ui-marketing-display-leading` | `1` |",
		"| `--ui-marketing-lead-measure` | `40rem` |",
		"| `--ui-marketing-lead-size` | `1.125rem` |",
		"| `--ui-marketing-chapter-size` | `2.75rem` |",
		"| `--ui-marketing-logo-height` | `1rem` |",
		"| `--ui-marketing-header-height` | `4rem` |",
		"| `--ui-marketing-cta-radius` | `0.5rem` |",
		"| `--ui-font-display` | `var(--ui-font-sans)` |",
		"",
		"## Factories",
		"",
		"- `marketingContainer()`",
		'- `marketingSectionSpace("hero" | "normal" | "compact")`',
		'- `marketingBandTone("plain" | "tinted" | "grid" | "inverse")`',
		"- `displayHeading(1 | 2 | 3)`",
		"- `marketingLead()`",
		"- `marketingHairline()`",
		"- `logoCloudMark()`",
		"",
		"## Motion",
		"",
		"Apply `viewReveal()` from `@sdxc/ui/animations` on band hosts. Reduced-motion is handled there.",
		"",
		"Listbox `Section` remains for menus; marketing bands compose these factories today and will use `MarketingSection` later.",
		"",
	].join("\n");
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
