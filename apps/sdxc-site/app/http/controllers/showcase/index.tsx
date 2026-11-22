/**
 * `GET /showcase` — everything built on these packages: the applications running in
 * production in a row of large tiles, then every demo for an invented product in one grid.
 * `?kind=` narrows the page, so each filter is a link with its own address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { gap, grid, gridTemplate, vstack } from "@sdxc/u/layout";
import { is, m, maxIs } from "@sdxc/u/size";
import { leading, text } from "@sdxc/u/typography";
import { createAction } from "remix/router";

import type { ShowcaseFilter } from "~/app/services/case-studies";

import { withBundleCache } from "~/app/http/caching";
import { pageSchema, seo } from "~/app/initializers/seo";
import {
	SHOWCASE_FILTERS,
	listShowcaseItems,
	matchesFilter,
	readFilter,
} from "~/app/services/case-studies";
import { listShowcase } from "~/app/services/showcase";
import Actions from "~/resources/components/actions";
import Hero from "~/resources/components/hero";
import { ProseHeading, ProseParagraph } from "~/resources/components/prose";
import SectionBlock from "~/resources/components/section-block";
import { ShowcaseFilters, ShowcaseTile } from "~/resources/components/showcase-gallery";
import SiteHeader from "~/resources/components/site-header";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** What a reader learns from the page before they scroll, for search results and link previews. */
const DESCRIPTION =
	"Applications running in production on the sdxc packages, and demos for invented products built from @sdxc/ui — each with a case study of what it demonstrates and what it is built from.";

/** The heading over the grid, by filter, so a narrowed page names what it lists. */
const GRID_TITLES: Record<ShowcaseFilter, string> = {
	all: "Demos",
	production: "In production",
	demo: "Demos",
	app: "App demos",
	landing: "Landing demos",
	docs: "Docs demos",
};

export default createAction(routes.showcase.index, async (ctx) => {
	let filter = readFilter(ctx.url.searchParams.get("kind"));
	let items = await listShowcaseItems();
	let counts = Object.fromEntries(
		SHOWCASE_FILTERS.map((name) => [
			name,
			items.filter((item) => matchesFilter(item, name)).length,
		]),
	) as Record<ShowcaseFilter, number>;

	let packageCounts = new Map(listShowcase().map((entry) => [entry.directory, entry.packageCount]));
	let production = items
		.filter((item) => item.kind === "production")
		.sort(
			(a, b) =>
				Number(b.liveHref !== null) - Number(a.liveHref !== null) ||
				(packageCounts.get(b.slug) ?? 0) - (packageCounts.get(a.slug) ?? 0),
		);
	let live = production.filter((item) => item.liveHref !== null).length;
	let showsProduction = filter === "all" || filter === "production";
	let rest = items.filter((item) => item.kind === "demo" && matchesFilter(item, filter));

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="Showcase — sdxc"
			description={DESCRIPTION}
			canonical={new URL(routes.showcase.index.href(), ctx.url).href}
			schema={pageSchema({
				name: "Showcase",
				description: DESCRIPTION,
				url: seo.canonical(ctx.url),
				cardTitle: "Showcase — sdxc",
			})}
		>
			<SiteHeader activePath={routes.showcase.index.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				<Hero>
					<div mix={[vstack({ gap: 6, align: "start" }), maxIs("44rem")]}>
						<ProseHeading level={1}>Showcase</ProseHeading>
						<ProseParagraph>
							{live} applications run in production on these packages
							{production.length > live
								? `, ${production.length - live} more is source only,`
								: ""}{" "}
							and {counts.demo} demos for invented products show what @sdxc/ui builds: apps, landing
							pages and documentation sites, each in its own art direction. Every one has a case
							study of what it demonstrates and what it is built from.
						</ProseParagraph>
						<ShowcaseFilters current={filter} counts={counts} />
					</div>
				</Hero>

				{showsProduction ? (
					<SectionBlock
						id="production"
						eyebrow="Running in production"
						title="Real applications"
						tone="tinted"
					>
						<div
							mix={[
								grid(),
								gridTemplate({ columns: "repeat(auto-fill, minmax(min(100%, 26rem), 1fr))" }),
								gap(10, 8),
							]}
						>
							{production.map((item) => (
								<ShowcaseTile
									key={item.slug}
									item={item}
									size="large"
									packageCount={packageCounts.get(item.slug)}
								/>
							))}
						</div>
					</SectionBlock>
				) : null}

				{rest.length > 0 ? (
					<SectionBlock id="items" eyebrow="Built from @sdxc/ui" title={GRID_TITLES[filter]}>
						<p mix={[m(0), maxIs("44rem"), text("sm"), leading("relaxed"), fg("neutral")]}>
							Every demo invents its product, its name and its data, so it can show a whole app,
							landing or docs site working; none of them is a real company or an sdxc product.
						</p>
						<div
							mix={[
								grid(),
								gridTemplate({ columns: "repeat(auto-fill, minmax(min(100%, 18rem), 1fr))" }),
								gap(10, 6),
							]}
						>
							{rest.map((item) => (
								<ShowcaseTile key={item.slug} item={item} />
							))}
						</div>
					</SectionBlock>
				) : (
					<span id="items" />
				)}

				<SectionBlock id="build" title="Build your own." tone="grid" align="center">
					<p>Every one of these started with one package. Start yours the same way.</p>

					<Actions
						cta-href="/docs/getting-started/install-and-pin"
						cta-label="Install your first package"
						alt-href={routes.api.index.href()}
						alt-label="Browse the API"
					>
						{null}
					</Actions>
				</SectionBlock>
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, ctx.url.search);
});
