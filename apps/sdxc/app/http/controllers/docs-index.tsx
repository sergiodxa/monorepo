/**
 * `GET /docs` — the hub. A reader arriving here wants one of a small number of
 * different things, and a sidebar with three hundred leaves answers none of them, so
 * the page routes by intent instead. One card per guide section, built from the
 * sections themselves, keeps the hub current with the tree it points into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m } from "@sdxc/u/size";
import { text, tracking, weight } from "@sdxc/u/typography";
import { Card, Link } from "@sdxc/ui";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { sponsorsTag } from "~/app/http/middleware/sponsors";
import { listGuides } from "~/app/services/docs";
import { buildGuidesNav } from "~/app/services/navigation";
import { readPackageFacts } from "~/app/services/packages";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const DESCRIPTION =
	"Guides to the collection as a whole: what it is, the conventions it keeps, and how it ships.";

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
		<DocumentLayout
			title="Documentation — sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
			sponsors={ctx.sponsors}
		>
			<DocsLayout tree={tree} activePath={routes.docs.index.href()} breadcrumbs={[]}>
				<header mix={[vstack({ gap: 3 })]}>
					<h1 mix={[m(0), text("4xl"), weight("bold"), tracking("tight")]}>Documentation</h1>
					<p mix={[m(0), text("lg"), fg("neutral")]}>{DESCRIPTION}</p>
				</header>

				<div
					mix={[
						grid(),
						gap(4),
						is("100%"),
						m("2.5rem", 0, 0, 0),
						gridTemplate({ columns: "1fr" }),
						media(
							"(min-width: 40rem)",
							gridTemplate({ columns: repeat("auto-fit", "minmax(18rem, 1fr)") }),
						),
					]}
				>
					{destinations.map((destination) => (
						<Card key={destination.title}>
							<Card.Header>
								<Card.Title>{destination.title}</Card.Title>
								<Card.Description>{destination.description}</Card.Description>
							</Card.Header>
							<Card.Footer>
								<Link href={destination.href} mix={[text("sm"), weight("medium")]}>
									{destination.label}
								</Link>
							</Card.Footer>
						</Card>
					))}
				</div>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(ctx.sponsors));
});
