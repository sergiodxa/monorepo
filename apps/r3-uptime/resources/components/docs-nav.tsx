/**
 * Client island: the docs sidebar's search box and navigation list. Typing into the
 * search field filters every doc by title (case-insensitive substring match) into a
 * flat result list, each row labeled with its source section so docs that share a
 * title across sections stay distinguishable; clearing it restores the sections
 * grouped by `frontmatter.section.title`. The link matching `activePath` renders
 * with a solid active background so visitors can tell which page they're on.
 *
 * Composes `@pkg/r3-ui`'s `SearchField`/`SearchField.Input` for the search box, and
 * `NavLink` (styled with the same `--ui-neutral-bg-tint-hover`/`--ui-radius-lg`
 * tokens `Sidebar.Item` uses for its own rows) for the nav-list links, instead of
 * hand-rolled equivalents of both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { NavLink, SearchField } from "@pkg/r3-ui";
import { bg, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { listStyle, raw } from "@pkg/u/general";
import { block } from "@pkg/u/layout";
import { m, p } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { fontSize, textTransform, tracking, weight } from "@pkg/u/typography";
import { clientEntry, on } from "remix/ui";

/** One doc link, reduced to the fields the sidebar actually renders. */
type DocsNavDoc = { path: string; title: string };

/** One sidebar section: a group heading plus the docs under it. */
type DocsNavSection = { title: string; docs: DocsNavDoc[] };

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type DocsNavProps = {
	sections: DocsNavSection[];
	activePath: string;
	searchPlaceholder: string;
};

const navList = [listStyle(), m(0), p(0)];

const sectionTitle = [
	fontSize("xs"),
	weight(700),
	textTransform("uppercase"),
	// 0.03em sits 0.005em (~0.08px at this font size) off the named `wide` step
	// (0.025em) — close enough to be imperceptible, so this promotes to the
	// scale instead of staying a one-off literal.
	tracking("wide"),
	fg("neutral.muted"),
	// Physical 3-value margin shorthand (top / left+right / bottom) — `@pkg/u`'s
	// `m()` only covers the 1/2/4-value logical form, not a 3-value one.
	raw({ margin: "20px 20px 8px" }),
];

/**
 * A doc nav row: `NavLink` styled with the same tokens `Sidebar.Item` uses for
 * its own rows (row padding, radius, hover/current tint) instead of an inline
 * text link's underline treatment — `hasBackground` drops that underline.
 */
const navLink = [
	block(),
	p("6px", "20px"),
	m(0, "8px"),
	rounded("lg"),
	fontSize("sm"),

	when("&:hover", bg("neutral.bg-tint-hover")),

	when('&[aria-current]:not([aria-current="false"])', [
		bg("neutral.bg-tint-hover"),
		fg("neutral.emphasis"),
	]),
];

/** Renders {@link DocsNavProps.sections} grouped by section, or a flat filtered list once the visitor types a search query. */
export const DocsNav = clientEntry(
	"/resources/components/docs-nav.tsx#DocsNav",
	function DocsNav(handle: Handle<DocsNavProps>) {
		let search = "";

		return () => {
			let { sections, activePath, searchPlaceholder } = handle.props;
			let query = search.trim().toLowerCase();
			let results =
				query.length > 0
					? sections
							.flatMap((section) => section.docs.map((doc) => ({ ...doc, section: section.title })))
							.filter((doc) => doc.title.toLowerCase().includes(query))
					: null;

			return (
				<div>
					<SearchField
						aria-label={searchPlaceholder}
						// Physical 3-value margin shorthand (top / left+right / bottom) —
						// `@pkg/u`'s `m()` only covers the 1/2/4-value logical form.
						mix={[raw({ margin: "0 20px 8px" })]}
					>
						<SearchField.Input
							value={search}
							placeholder={searchPlaceholder}
							mix={[
								on("input", (event) => {
									search = event.currentTarget.value;
									handle.update();
								}),
							]}
						/>
					</SearchField>

					<nav>
						{results ? (
							<ul mix={[navList]}>
								{results.map((doc) => (
									<li key={doc.path}>
										<NavLink
											href={doc.path}
											hasBackground
											aria-current={doc.path === activePath ? "page" : undefined}
											mix={[navLink]}
										>
											{doc.title}
											<span mix={[block(), fontSize("xs"), fg("neutral.muted")]}>
												{doc.section}
											</span>
										</NavLink>
									</li>
								))}
							</ul>
						) : (
							sections.map((section) => (
								<div key={section.title}>
									<p mix={[sectionTitle]}>{section.title}</p>
									<ul mix={[navList]}>
										{section.docs.map((doc) => (
											<li key={doc.path}>
												<NavLink
													href={doc.path}
													hasBackground
													aria-current={doc.path === activePath ? "page" : undefined}
													mix={[navLink]}
												>
													{doc.title}
												</NavLink>
											</li>
										))}
									</ul>
								</div>
							))
						)}
					</nav>
				</div>
			);
		};
	},
);

export default DocsNav;
