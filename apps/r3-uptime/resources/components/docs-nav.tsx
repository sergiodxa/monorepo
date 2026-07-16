/**
 * Client island: the docs sidebar's search box and navigation list. Typing into the
 * search field filters every doc by title (case-insensitive substring match) into a
 * flat result list; clearing it restores the sections grouped by
 * `frontmatter.section.title`. The link matching `activePath` renders with a solid
 * active background so visitors can tell which page they're on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { SearchIcon } from "@pkg/lucide-remix";
import { clientEntry, css, on } from "remix/ui";
import input from "remix/ui/input";

import { neutral, primary } from "~/resources/theme";

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

const navList = css({ listStyle: "none", margin: 0, padding: 0 });

const sectionTitle = css({
	fontSize: "0.75rem",
	fontWeight: 700,
	textTransform: "uppercase",
	letterSpacing: "0.03em",
	color: neutral[500],
	margin: "20px 20px 8px",
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

const navLink = css({
	display: "block",
	padding: "6px 20px",
	margin: "0 8px",
	borderRadius: 6,
	fontSize: "0.875rem",
	color: neutral[700],
	textDecoration: "none",
	"&:hover": { background: neutral[100] },
	"@media (prefers-color-scheme: dark)": {
		color: neutral[400],
		"&:hover": { background: neutral[800] },
	},
});

const navLinkActive = css({
	background: primary[100],
	color: primary[600],
	fontWeight: 500,
	padding: "6px 8px",
	margin: "0 16px",
	"&:hover": { background: primary[100] },
	"@media (prefers-color-scheme: dark)": {
		background: "oklch(0.3 0.06 142)",
		color: neutral[50],
		"&:hover": { background: "oklch(0.3 0.06 142)" },
	},
});

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
							.flatMap((section) => section.docs)
							.filter((doc) => doc.title.toLowerCase().includes(query))
					: null;

			return (
				<div>
					<div
						mix={[
							input.root(),
							css({
								position: "relative",
								width: "auto",
								height: 40,
								margin: "0 20px 8px",
								padding: "8px 32px 8px 36px",
								borderRadius: 6,
								color: neutral[500],
								background: neutral[50],
								border: `1px solid ${neutral[200]}`,
								boxShadow: "none",
								textShadow: "none",
								"& input": { color: "inherit" },
								"@media (prefers-color-scheme: dark)": {
									color: neutral[400],
									background: neutral[950],
									borderColor: neutral[800],
								},
							}),
						]}
					>
						<SearchIcon
							size={16}
							strokeWidth={1.5}
							mix={css({
								position: "absolute",
								left: 12,
								top: "50%",
								transform: "translateY(-50%)",
							})}
						/>
						<input
							type="search"
							value={search}
							placeholder={searchPlaceholder}
							mix={[
								input.field(),
								on("input", (event) => {
									search = event.currentTarget.value;
									handle.update();
								}),
							]}
						/>
					</div>

					<nav>
						{results ? (
							<ul mix={[navList]}>
								{results.map((doc) => (
									<li key={doc.path}>
										<a
											href={doc.path}
											aria-current={doc.path === activePath ? "page" : undefined}
											mix={doc.path === activePath ? [navLink, navLinkActive] : [navLink]}
										>
											{doc.title}
										</a>
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
												<a
													href={doc.path}
													aria-current={doc.path === activePath ? "page" : undefined}
													mix={doc.path === activePath ? [navLink, navLinkActive] : [navLink]}
												>
													{doc.title}
												</a>
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
