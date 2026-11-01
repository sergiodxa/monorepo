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
	LANDING_PATTERNS_SUMMARY,
	LANDING_PATTERNS_TITLE,
	LANDING_COMPONENTS_SUMMARY,
	LANDING_COMPONENTS_TITLE,
	LANDING_FOUNDATIONS_SUMMARY,
	LANDING_FOUNDATIONS_TITLE,
	THEMING_SUMMARY,
	THEMING_TITLE,
	themeMarkdown,
	uiExportMarkdown,
	utilityMarkdown,
} from "~/app/services/catalogue-markdown";
import { listComponents, readComponent } from "~/app/services/components";
import { componentGroupTitle } from "~/app/services/navigation";
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

/** The landing foundations overview under the same component tree. */
export const LANDING_FOUNDATIONS_SLUG = "landing-foundations";

/** The landing components overview under the same component tree. */
export const LANDING_COMPONENTS_SLUG = "landing-components";

/** The landing patterns overview under the same component tree. */
export const LANDING_PATTERNS_SLUG = "landing-patterns";

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
		title: LANDING_FOUNDATIONS_TITLE,
		package: "@sdxc/ui",
		kind: "component",
		section: "Components",
		summary: LANDING_FOUNDATIONS_SUMMARY,
		params: { component: LANDING_FOUNDATIONS_SLUG },
		href: routes.api.component.href({ component: LANDING_FOUNDATIONS_SLUG }),
		markdownHref: routes.markdown.component.href({ component: LANDING_FOUNDATIONS_SLUG }),
	});

	pages.push({
		title: LANDING_COMPONENTS_TITLE,
		package: "@sdxc/ui",
		kind: "component",
		section: "Components",
		summary: LANDING_COMPONENTS_SUMMARY,
		params: { component: LANDING_COMPONENTS_SLUG },
		href: routes.api.component.href({ component: LANDING_COMPONENTS_SLUG }),
		markdownHref: routes.markdown.component.href({ component: LANDING_COMPONENTS_SLUG }),
	});

	pages.push({
		title: LANDING_PATTERNS_TITLE,
		package: "@sdxc/ui",
		kind: "component",
		section: "Components",
		summary: LANDING_PATTERNS_SUMMARY,
		params: { component: LANDING_PATTERNS_SLUG },
		href: routes.api.component.href({ component: LANDING_PATTERNS_SLUG }),
		markdownHref: routes.markdown.component.href({ component: LANDING_PATTERNS_SLUG }),
	});

	for (let entry of await listComponents()) {
		let reference = await readComponent(entry.slug);
		pages.push({
			title: entry.name,
			package: "@sdxc/ui",
			kind: "component",
			section: componentGroupTitle(entry.module),
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
	if (component === LANDING_FOUNDATIONS_SLUG) return landingFoundationsMarkdown();
	if (component === LANDING_COMPONENTS_SLUG) return landingComponentsMarkdown();
	if (component === LANDING_PATTERNS_SLUG) return landingPatternsMarkdown();

	let reference = await readComponent(component);
	return reference === null ? null : componentMarkdown(reference);
}

/**
 * The markdown twin of the landing foundations overview: tokens, factories,
 * and the motion recipe, matching what the HTML page demonstrates.
 */
function landingFoundationsMarkdown(): string {
	return [
		`# ${LANDING_FOUNDATIONS_TITLE}`,
		`> ${LANDING_FOUNDATIONS_SUMMARY}`,
		"",
		"Import the factories from `@sdxc/ui/styles` and the tokens from `@sdxc/ui/theme.css`.",
		"",
		"## Tokens",
		"",
		"| Token | Default |",
		"| --- | --- |",
		"| `--ui-landing-measure` | `72rem` |",
		"| `--ui-landing-gutter` | `1rem` (steps to 1.5rem / 2rem via container) |",
		"| `--ui-landing-section-space` | `6rem` |",
		"| `--ui-landing-section-space-compact` | `4rem` |",
		"| `--ui-landing-section-space-hero` | `8rem` |",
		"| `--ui-landing-display-tracking` | `-0.04em` |",
		"| `--ui-landing-display-weight` | `500` |",
		"| `--ui-landing-display-leading` | `1` |",
		"| `--ui-landing-lead-measure` | `40rem` |",
		"| `--ui-landing-lead-size` | `1.125rem` |",
		"| `--ui-landing-chapter-size` | `2.75rem` |",
		"| `--ui-landing-logo-height` | `1.75rem` (`2.25rem` from `lg`) |",
		"| `--ui-landing-header-height` | `4rem` |",
		"| `--ui-landing-cta-radius` | `0.5rem` |",
		"| `--ui-font-display` | `var(--ui-font-sans)` |",
		"",
		"## Factories",
		"",
		"- `landingContainer()`",
		'- `landingSectionSpace("hero" | "normal" | "compact" | "cta")`',
		'- `landingBandTone("plain" | "tinted" | "grid" | "inverse" | "brand" | "gradient")`',
		"- `displayHeading(1 | 2 | 3)`",
		"- `landingLead()`",
		"- `landingHairline()`",
		"- `logoCloudMark()`",
		"",
		"## Motion",
		"",
		"Apply `viewReveal()` from `@sdxc/ui/animations` on band hosts. Reduced-motion is handled there.",
		"",
		"Listbox `Section` remains for menus; landing pages compose `LandingSection` and the other landing primitives documented under Landing components.",
		"",
	].join("\n");
}

/**
 * The markdown twin of the landing components overview: the Phase 1
 * primitives and how they compose, matching what the HTML page demonstrates.
 */
function landingComponentsMarkdown(): string {
	return [
		`# ${LANDING_COMPONENTS_TITLE}`,
		`> ${LANDING_COMPONENTS_SUMMARY}`,
		"",
		"Import from `@sdxc/ui`. Style factories and tokens stay on `@sdxc/ui/styles` and `@sdxc/ui/theme.css`.",
		"",
		"## Primitives",
		"",
		"- `LandingSection` — band host (`tone`: plain | tinted | grid | inverse | brand | gradient; `spacing`: compact | normal | hero | cta; `align`, `ruled`, `variant`, `inset`: true | top | bottom)",
		"- `LandingHeader` — eyebrow + chapter title + lead (`eyebrowVariant`: mono | quiet | soft | pill | numbered; `eyebrowHref`, `eyebrowIndex`)",
		'- `CtaGroup` — wrapping primary/secondary actions; `size` (default `md`, 40px) reaches every action without its own, `stack="phone"` stacks them on a phone',
		"- `Split` / `Split.Copy` / `Split.Media` — two-column band content",
		"- `StatStrip` / `StatStrip.Item` — numeric proof strip, one row from the `lg` container",
		"- `LogoCloud` — adopter marks at `--ui-landing-logo-height` (`layout`: row | spread | grid; `label`, `muted`)",
		"- `Feature` / `Feature.Grid` — claim cells and hairline grid",
		"",
		"## Pairing notes",
		"",
		'- Hero and closing CTAs: the group\'s `md` default (40px), a `variant="surface"` secondary, `landingCtaChrome()` on both',
		'- Nav CTAs: `size="sm"` (~32px)',
		'- `Heading size="display" | "chapter"` for landing type without a header wrapper',
		"- Product empty states stay on `Empty` / `Card`; landing claims use `Feature`",
		"",
	].join("\n");
}

/**
 * The markdown twin of the landing patterns overview: building blocks and
 * composition craft from `@sdxc/ui/landing`.
 */
function landingPatternsMarkdown(): string {
	return [
		`# ${LANDING_PATTERNS_TITLE}`,
		`> ${LANDING_PATTERNS_SUMMARY}`,
		"",
		"Import from `@sdxc/ui/landing`. Primitives stay on `@sdxc/ui`.",
		"",
		"## Building blocks",
		"",
		"- `LandingHero` — eyebrow (`quiet` default, `eyebrowHref`), display title, lead, actions, `note`, `proof`, media (`below` default) and `backdrop`",
		"- `ProofStrip` — LogoCloud and/or StatStrip after the hero",
		"- `FeatureBand` — header + `layout`: split | grid | steps",
		"- `FaqBand` — header + one or two Accordion columns",
		"- `ClosingCta` — inverse/tinted close with CTAs at the `cta` spacing",
		"",
		"## Composition craft",
		"",
		"- `ProductFrame`, `CodeStage` / `TerminalPanel`",
		"- `InstallTabs`, `TabbedStage`",
		"- `CheckList` / `CheckRow`, `IconWell`, `Bento`, `StepList`",
		"- `AnnouncementChip` (eyebrow looks + `special`, `href`), `AccentText`",
		"",
		"## Assembled page",
		"",
		"Hero → Proof → FeatureBand × N → Faq → ClosingCta. Copy is always props.",
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
