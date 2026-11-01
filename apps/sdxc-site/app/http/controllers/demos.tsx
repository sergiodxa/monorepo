/**
 * `GET /demo` — the gallery of every demo: each sample landing and each sample docs site
 * built from `@sdxc/ui`, with what it is and the art direction it commits to. Marked
 * `noindex, nofollow` like the demos, since every one of them invents its product.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg, outline } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, m, maxIs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";
import { Feature } from "@sdxc/ui/landing";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import Hero from "~/resources/components/hero";
import { ProseHeading, ProseParagraph } from "~/resources/components/prose";
import SectionBlock from "~/resources/components/section-block";
import SiteHeader from "~/resources/components/site-header";
import DocumentLayout from "~/resources/layouts/document";
import { demoDocsHref, listDemoDocsSites } from "~/resources/views/demo-docs";
import { listDemoLandings } from "~/resources/views/demos";
import routes from "~/routes/web";

/** The directive the gallery shares with every demo it lists. */
const DEMO_ROBOTS = "noindex, nofollow";

export default createAction(routes.demos, async (ctx) => {
	let [landings, docsSites] = await Promise.all([listDemoLandings(), listDemoDocsSites()]);

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="Demos — sdxc"
			description="Every sample landing and docs site built from @sdxc/ui, each for an invented product with its own art direction."
			canonical={ctx.url.href}
			robots={DEMO_ROBOTS}
		>
			<SiteHeader activePath={routes.demos.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				<Hero>
					<div mix={[vstack({ gap: 6, align: "start" }), maxIs("40rem")]}>
						<ProseHeading level={1}>Demos</ProseHeading>
						<ProseParagraph>
							Whole sites built from @sdxc/ui, each for an invented product.
						</ProseParagraph>
					</div>
				</Hero>

				<SectionBlock id="landings" title="Landing pages" tone="tinted">
					<Feature.Grid columns={3}>
						{landings.map((demo) => (
							<DemoCard
								key={demo.slug}
								href={routes.demo.href({ slug: demo.slug })}
								name={demo.title.split(" — ")[0] ?? demo.title}
								kind={demo.kind}
								tagline={demo.tagline}
								artDirection={demo.artDirection}
							/>
						))}
					</Feature.Grid>
				</SectionBlock>

				<SectionBlock id="docs" title="Docs sites">
					<Feature.Grid columns={2}>
						{docsSites.map((site) => (
							<DemoCard
								key={site.slug}
								href={demoDocsHref(site.slug)()}
								name={site.name}
								kind={site.kind}
								tagline={site.tagline}
								artDirection={site.artDirection}
							/>
						))}
					</Feature.Grid>
				</SectionBlock>
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});

namespace DemoCard {
	export interface Props {
		href: string;
		name: string;
		/** The kind of page the demo shows ("SaaS landing", "API reference"). */
		kind: string;
		/** What the invented product is, in a few words. */
		tagline: string;
		/** The palette, type and shapes it commits to, in a few words. */
		artDirection: string;
	}
}

/**
 * One demo's card, which as a whole opens the demo: the name is the link, stretched over
 * the card, so a screen reader announces the name alone while any press on the card follows it.
 */
function DemoCard(handle: Handle<DemoCard.Props>) {
	return () => {
		let { artDirection, href, kind, name, tagline } = handle.props;
		return (
			<Feature
				mix={[
					raw({ transition: "background-color 150ms" }),
					when(
						"&:has([data-slot='demo-link']:hover)",
						raw({
							backgroundColor:
								"color-mix(in oklch, var(--ui-surface-raised, Canvas), var(--ui-brand-bg-solid) 6%)",
						}),
					),
					when(
						"&:has([data-slot='demo-link']:focus-visible)",
						outline({ color: "brand.ring", width: 2, offset: 2 }),
					),
				]}
			>
				<div mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
					<Feature.Title>
						<a
							href={href}
							data-slot="demo-link"
							mix={[
								raw({ color: "inherit", textDecoration: "none", outline: "none" }),
								when("&::after", raw({ content: '""', position: "absolute", inset: "0" })),
							]}
						>
							{name}
						</a>
					</Feature.Title>
					<Badge color="brand">{kind}</Badge>
				</div>
				<Feature.Description>
					<p mix={[m(0), fg("neutral.emphasis"), leading("snug")]}>{tagline}</p>
					<p mix={[m(0), text("sm")]}>{artDirection}</p>
				</Feature.Description>
			</Feature>
		);
	};
}
