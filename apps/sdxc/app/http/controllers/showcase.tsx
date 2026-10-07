/**
 * `GET /showcase` — the applications these packages are built and proven in. The list
 * is curated rather than exhaustive: an app reaching for a handful of packages proves
 * nothing about them, and the same five are the ones a package page names as its
 * users, so the two surfaces never disagree about how many there are.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArrowRightIcon, ArrowUpRightIcon } from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m, maxIs, mbs, p } from "@sdxc/u/size";
import { font, leading, nowrap, text, textTransform, tracking, weight } from "@sdxc/u/typography";
import { Badge, LinkButton } from "@sdxc/ui";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { listGuides } from "~/app/services/docs";
import { listShowcase } from "~/app/services/showcase";
import Band from "~/resources/components/band";
import FeatureGrid from "~/resources/components/feature-grid";
import { DisplayHeadings, ProseHeading } from "~/resources/components/prose";
import SiteHeader from "~/resources/components/site-header";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The one-sentence summary search results and link previews show. */
const DESCRIPTION =
	"Five applications built on these packages, each with the number of them it installs, read from its own manifest.";

/** What the page argues, which is Rails' framing rather than a logo wall's. */
const INTRODUCTION =
	"These are reference applications rather than customers: five things that run on the collection, listed with what reading each one is worth and how deep into the set it goes. Two of them have no deployment, and say so.";

export default createAction(routes.showcase, async (ctx) => {
	let applications = listShowcase();
	let first = (await listGuides()).at(0)?.guides.at(0);
	let firstGuide = first ? routes.docs.show.href({ slug: first.slug }) : null;

	let response = await ctx.render(
		<DocumentLayout title="Showcase — sdxc" description={DESCRIPTION} canonical={ctx.url.href}>
			<SiteHeader activePath={routes.showcase.href()} />

			<main mix={[vstack({ align: "center" }), is("100%")]}>
				<Band tone="grid" spacing="hero" ruled={false}>
					<DisplayHeadings>
						<header mix={[vstack({ gap: 6, align: "start" }), maxIs("48rem")]}>
							<p
								mix={[
									m(0),
									font("mono"),
									text("xs"),
									textTransform("uppercase"),
									tracking("widest"),
									fg("brand"),
								]}
							>
								[ Showcase ]
							</p>
							<ProseHeading level={1}>Built on these packages</ProseHeading>
							<p mix={[m(0), text("lg"), leading("relaxed"), fg("neutral")]}>{INTRODUCTION}</p>
						</header>
					</DisplayHeadings>
				</Band>

				<Band>
					<div mix={[vstack({ gap: 8, align: "stretch" })]}>
						<FeatureGrid columns="2">
							{applications.map((application) => (
								<article
									key={application.directory}
									mix={[
										vstack({ gap: 4, align: "stretch" }),
										bg(),
										p(8, 6),
										media("(min-width: 48rem)", p(10, 10)),
									]}
								>
									<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
										<h2
											mix={[
												m(0),
												font("mono"),
												text("2xl"),
												weight("medium"),
												tracking("tight"),
												nowrap(),
												fg("neutral.emphasis"),
											]}
										>
											{application.title}
										</h2>
										<Badge color="brand">{application.packageCount} packages</Badge>
										{application.href === null ? <Badge color="neutral">Source only</Badge> : null}
									</div>

									<p mix={[m(0), text("lg"), leading("snug"), fg("neutral.emphasis")]}>
										{application.summary}
									</p>
									<p mix={[m(0), text("base"), leading("relaxed"), fg("neutral")]}>
										{application.study}
									</p>

									<div mix={[hstack({ gap: 3, align: "center" }), flexWrap(), mbs("auto")]}>
										{application.href ? (
											<LinkButton href={application.href} rel="noreferrer" size="sm" color="brand">
												Open it
												<ArrowUpRightIcon size={14} aria-hidden="true" />
											</LinkButton>
										) : null}
										<LinkButton
											href={application.sourceHref}
											rel="noreferrer"
											variant="outline"
											color="neutral"
											size="sm"
										>
											Read the source
											<ArrowUpRightIcon size={14} aria-hidden="true" />
										</LinkButton>
									</div>
								</article>
							))}

							{/*
							 * The grid always ends on an invitation, so a reader who has seen what runs on
							 * the set is one click from starting their own. As the last cell it fills the
							 * row beside an odd application out, and stretches across a row of its own.
							 */}
							<article
								mix={[
									vstack({ gap: 4, align: "stretch" }),
									bg(),
									raw({
										backgroundImage:
											"radial-gradient(80% 90% at 100% 0%, color-mix(in oklch, var(--ui-brand-bg-solid) 16%, transparent), transparent 70%)",
									}),
									p(8, 6),
									media("(min-width: 48rem)", p(10, 10)),
								]}
							>
								<h2
									mix={[
										m(0),
										text("2xl"),
										weight("medium"),
										tracking("tight"),
										fg("neutral.emphasis"),
									]}
								>
									Build your own
								</h2>
								<p mix={[m(0), text("lg"), leading("snug"), fg("neutral.emphasis")]}>
									Every application here started with one package and took the next one when it
									needed it.
								</p>
								<p mix={[m(0), text("base"), leading("relaxed"), fg("neutral")]}>
									The guides open on what the collection is and walk you through your first handler,
									from install to a Response.
								</p>

								<div mix={[hstack({ gap: 3, align: "center" }), flexWrap(), mbs("auto")]}>
									{firstGuide ? (
										<LinkButton href={firstGuide} size="sm" color="brand">
											Start with the guides
											<ArrowRightIcon size={14} aria-hidden="true" />
										</LinkButton>
									) : null}
									<LinkButton
										href={routes.api.index.href()}
										variant="outline"
										color="neutral"
										size="sm"
									>
										Browse the API
										<ArrowRightIcon size={14} aria-hidden="true" />
									</LinkButton>
								</div>
							</article>
						</FeatureGrid>

						<p mix={[m(0), maxIs("48rem"), text("sm"), leading("relaxed"), fg("neutral")]}>
							Each count is that application&apos;s <code mix={[font("mono")]}>@sdxc/*</code>{" "}
							dependencies, read from its own <code mix={[font("mono")]}>package.json</code>. Every
							package&apos;s reference page names which of these five install it, read from the same
							files.
						</p>
					</div>
				</Band>
			</main>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});
