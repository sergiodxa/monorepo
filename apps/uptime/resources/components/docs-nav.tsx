/**
 * Client island: the docs sidebar's search box and navigation list. Typing
 * filters every doc by title into a flat, section-labeled list; clearing it
 * restores the sections grouped by `frontmatter.section.title`.
 *
 * Composes `@pkg/ui`'s `SearchField`/`SearchField.Input` and `NavLink`, styled
 * with the same tokens `Sidebar.Item` uses for its own rows, so the search box
 * and nav rows stay visually consistent with the rest of the sidebar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { listStyle, raw } from "@pkg/u/general";
import { block } from "@pkg/u/layout";
import { m, p } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { fontSize, textTransform, tracking, weight } from "@pkg/u/typography";
import { NavLink, SearchField } from "@pkg/ui";
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

/**
 * `tracking("wide")` (0.025em) reads identically to the literal 0.03em this
 * heading used, so the value promotes to the named scale step. The margin uses
 * `raw()`'s physical 3-value shorthand, since `m()` only covers 1/2/4-value form.
 */
const sectionTitle = [
	fontSize("xs"),
	weight(700),
	textTransform("uppercase"),
	tracking("wide"),
	fg("neutral.muted"),
	raw({ margin: "20px 20px 8px" }),
];

/**
 * A doc nav row: `NavLink` styled with the same tokens `Sidebar.Item` uses for
 * its own rows (row padding, radius, hover/current tint), with `hasBackground`
 * so the row renders as a solid tinted block.
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

/**
 * Renders {@link DocsNavProps.sections} grouped by section, or a flat filtered
 * list once the visitor types a search query. The search field's margin uses
 * `raw()`'s physical 3-value shorthand, since `m()` only covers 1/2/4-value form.
 */
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
					<SearchField aria-label={searchPlaceholder} mix={[raw({ margin: "0 20px 8px" })]}>
						<SearchField.Input
							value={search}
							placeholder={searchPlaceholder}
							mix={[
								on("input", (event) => {
									search = event.currentTarget.value;
									void handle.update();
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
