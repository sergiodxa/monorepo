/**
 * `GET /docs` — the hub. A reader arriving here wants one of a small number of
 * different things, and a sidebar with three hundred leaves answers none of them, so
 * the page routes by intent instead. One card per guide section, built from the
 * sections themselves, keeps the hub current with the tree it points into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { m } from "@sdxc/u/size";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { listGuides } from "~/app/services/docs";
import { buildGuidesNav } from "~/app/services/navigation";
import { readPackageFacts } from "~/app/services/packages";
import Feature from "~/resources/components/feature";
import FeatureGrid from "~/resources/components/feature-grid";
import PageTitle from "~/resources/components/page-title";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const DESCRIPTION =
	"What the collection is, the conventions it keeps, and how to build a Remix app with it, from the router to the jobs behind it.";

/** Where the day's releases and the commits behind them are published. */
const RELEASES_HREF = "https://github.com/sergiodxa/monorepo/releases";

export default createAction(routes.docs.index, async (ctx) => {
	let sections = await listGuides();
	let tree = await buildGuidesNav();
	let facts = readPackageFacts();

	/** One destination per intent: a section is entered at its first page. */
	let destinations = sections
		.flatMap((section) => {
			let first = section.guides.at(0);
			if (!first) return [];
			return [
				{
					title: section.title,
					description: first.frontmatter.description,
					label: first.frontmatter.title,
					href: routes.docs.show.href({ slug: first.slug }),
				},
			];
		})
		.concat([
			{
				title: "Browse the packages",
				description: `All ${facts.published}, filterable by name and by what they do, each with its own reference page.`,
				label: "Open the index",
				href: routes.api.index.href(),
			},
			{
				title: "Watch what ships",
				description:
					"One release a day at most, named for the date it went out, with the commits that went into it.",
				label: "Read the releases",
				href: RELEASES_HREF,
			},
		]);

	let response = await ctx.render(
		<DocumentLayout title="Documentation — sdxc" description={DESCRIPTION} canonical={ctx.url.href}>
			<DocsLayout tree={tree} activePath={routes.docs.index.href()} breadcrumbs={[]}>
				<PageTitle eyebrow="Guides" title="Documentation">
					{DESCRIPTION}
				</PageTitle>

				<div mix={[m("2.5rem", 0, 0, 0)]}>
					<FeatureGrid columns="2">
						{destinations.map((destination) => (
							<Feature
								key={destination.title}
								title={destination.title}
								href={destination.href}
								link-label={destination.label}
							>
								{destination.description}
							</Feature>
						))}
					</FeatureGrid>
				</div>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});
