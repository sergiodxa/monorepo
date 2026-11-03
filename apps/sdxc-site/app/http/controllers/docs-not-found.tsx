/**
 * The 404 a documentation route answers with. It keeps the shell, because a reader
 * who mistyped a slug is one click from the tree they wanted, searches for the words in
 * the address, and asks search engines to leave it out, since the address names no page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { Button, SearchField } from "@sdxc/ui";
import { DocsNotFound, searchQueryFromPath } from "@sdxc/ui/docs";

import type { AppContext } from "~/app/initializers/router";
import type { NavTree } from "~/app/services/navigation";

import { listStartGuides } from "~/app/services/docs";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The 404's words. */
const LABELS: DocsNotFound.Labels = {
	eyebrow: "404",
	title: "Page not found",
	body: "No documentation page answers to this address. Search for what it names, or start from one of these.",
	linksTitle: "Start from one of these",
};

/** How many of the newcomer's guides the 404 offers after the way back. */
const START_LINKS = 3;

/**
 * Renders the documentation 404 with a `404` status: the missing address, a search form
 * that `GET`s `/search` pre-filled from the address's last segment, the way back to the
 * tree the address was under, then the first guides a newcomer reads.
 *
 * @param ctx - The request being answered.
 * @param tree - The tree of the part of the site the address was under, so the shell around the message still navigates and the way back leads to where the reader was.
 * @returns The rendered 404 document.
 */
export default async function docsNotFound(ctx: AppContext, tree: NavTree) {
	let path = ctx.url.pathname;
	let guides = (await listStartGuides()).slice(0, START_LINKS);
	let links: DocsNotFound.Link[] = [
		{ title: `Back to ${tree.label}`, href: tree.href },
		...guides
			.map((guide) => ({
				title: guide.frontmatter.title,
				href: routes.docs.show.href({ slug: guide.slug }),
				description: guide.frontmatter.description,
			}))
			.filter((link) => link.href !== tree.href),
	];

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="Not found — sdxc"
			description="No documentation page answers to that address."
			robots="noindex"
			siteFooter={false}
		>
			<DocsLayout tree={tree} filterQuery={ctx.url.searchParams.get("filter")} activePath="">
				<DocsNotFound
					path={path}
					labels={LABELS}
					links={links}
					search={
						<SearchField aria-label="Search the documentation">
							<form
								method="get"
								action={routes.search.href()}
								mix={[hstack({ gap: 2, align: "center" })]}
							>
								<div mix={[raw({ flex: "1 1 auto", minInlineSize: "0" })]}>
									<SearchField.Input
										name="q"
										aria-label="Search the documentation"
										defaultValue={searchQueryFromPath(path)}
									/>
								</div>
								<Button type="submit" variant="outline" color="neutral">
									Search
								</Button>
							</form>
						</SearchField>
					}
				/>
			</DocsLayout>
		</DocumentLayout>,
		{ status: 404 },
	);
}
