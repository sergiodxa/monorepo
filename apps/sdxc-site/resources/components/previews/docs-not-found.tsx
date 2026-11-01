/**
 * Live preview for `DocsNotFound`: the 404 a reader sees after following an old link to
 * `/docs/guides/web-hooks`, with the search already holding "web hooks" and the two pages
 * most readers start from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { HeadingScope, SearchField } from "@sdxc/ui";
import { DocsNotFound, searchQueryFromPath } from "@sdxc/ui/docs";

/** The address the preview pretends matched nothing. */
const MISSING_PATH = "/docs/guides/web-hooks";

/** The source the page shows, matching the markup below. */
const CODE = `<DocsNotFound
	path={url.pathname}
	search={
		<SearchField aria-label="Search the docs">
			<SearchField.Input name="q" defaultValue={searchQueryFromPath(url.pathname)} />
		</SearchField>
	}
	links={[
		{ title: "Quickstart", href: "/examples/docs/quickstart", description: "Add your first monitor." },
		{ title: "API overview", href: "/examples/docs/api/overview", description: "Create monitors from code." },
	]}
	labels={{
		eyebrow: "404",
		title: "Page not found",
		body: "No page answers to this address. It may have moved, so search for it.",
		linksTitle: "Or start from one of these",
	}}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<HeadingScope>
				<DocsNotFound
					path={MISSING_PATH}
					search={
						<SearchField aria-label="Search the docs">
							<SearchField.Input name="q" defaultValue={searchQueryFromPath(MISSING_PATH)} />
						</SearchField>
					}
					links={[
						{
							title: "Quickstart",
							href: "/examples/docs/quickstart",
							description: "Add your first monitor.",
						},
						{
							title: "API overview",
							href: "/examples/docs/api/overview",
							description: "Create monitors from code.",
						},
					]}
					labels={{
						eyebrow: "404",
						title: "Page not found",
						body: "No page answers to this address. It may have moved, so search for it.",
						linksTitle: "Or start from one of these",
					}}
				/>
			</HeadingScope>
		</div>
	),
};
