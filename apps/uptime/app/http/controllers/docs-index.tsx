/**
 * `/docs` is the hub: the two pages most readers start from, then every guide grouped by
 * the section the sidebar files it under, so a reader picks a topic before a page and
 * the landing URL names something more useful than the first doc.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { font, text, textTransform, tracking, weight } from "@sdxc/u/typography";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/initializers/seo";
import { listDocs } from "~/app/services/docs";
import DocsStartCard from "~/resources/components/docs-start-card";
import DocsLayout, { buildDocsLabels } from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The pages a first-time reader is pointed at before the full list, in this order. */
const START_HERE = ["/docs/quickstart", "/docs/api/overview"];

/** GET /docs — the documentation hub. */
export default createAction(routes.docs.index, async (ctx) => {
	let sections = await listDocs();
	let isSignedIn = getViewer() !== null;
	let docs = sections.flatMap((section) => section.docs);
	let featured = START_HERE.flatMap((path) => docs.filter((doc) => doc.path === path));

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={ctx.intl.t("docs.meta.title")}
			locale={ctx.locale}
			seo={{ description: ctx.intl.t("docs.meta.description"), canonical: SEO.canonical(ctx.url) }}
		>
			<DocsLayout
				isSignedIn={isSignedIn}
				chrome={buildMarketingChrome(ctx.intl.t)}
				sections={sections}
				activePath={routes.docs.index.href()}
				labels={buildDocsLabels(ctx.intl.t)}
			>
				<header mix={[vstack({ gap: 3 }), m(0, 0, "2.5rem", 0)]}>
					<p
						mix={[
							m(0),
							font("mono"),
							text("xs"),
							weight("medium"),
							textTransform("uppercase"),
							tracking("widest"),
							fg("brand"),
						]}
					>
						{ctx.intl.t("docs.hub.eyebrow")}
					</p>
					<h1
						mix={[
							m(0),
							text("4xl"),
							fg("neutral.emphasis"),
							raw({ fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.1 }),
						]}
					>
						{ctx.intl.t("docs.hub.title")}
					</h1>
					<p mix={[m(0), text("lg"), fg("neutral"), raw({ textWrap: "pretty" })]}>
						{ctx.intl.t("docs.hub.description")}
					</p>
				</header>

				<section aria-labelledby="docs-start" mix={[vstack({ gap: 4 }), m(0, 0, "3rem", 0)]}>
					<h2 id="docs-start" mix={[m(0), text("lg"), weight("semibold"), fg("neutral.emphasis")]}>
						{ctx.intl.t("docs.hub.start")}
					</h2>
					<div
						mix={[
							grid(),
							gap(3),
							gridTemplate({ columns: "minmax(0, 1fr)" }),
							media("(min-width: 40rem)", gridTemplate({ columns: "repeat(2, minmax(0, 1fr))" })),
						]}
					>
						{featured.map((doc) => (
							<DocsStartCard
								key={doc.path}
								href={doc.path}
								section={doc.frontmatter.section.title}
								title={doc.frontmatter.title}
								description={doc.frontmatter.description}
								cta={ctx.intl.t("docs.hub.read")}
							/>
						))}
					</div>
				</section>

				<section aria-labelledby="docs-topics" mix={[vstack({ gap: 4 })]}>
					<h2 id="docs-topics" mix={[m(0), text("lg"), weight("semibold"), fg("neutral.emphasis")]}>
						{ctx.intl.t("docs.hub.topics")}
					</h2>
					<div
						mix={[
							raw({ columnGap: "0.75rem" }),
							media("(min-width: 40rem)", raw({ columnCount: 2 })),
						]}
					>
						{sections.map((section) => (
							<div
								key={section.title}
								mix={[
									vstack({ gap: 3 }),
									p(5),
									m(0, 0, "0.75rem", 0),
									rounded("lg"),
									border({ color: "neutral.border", width: 1, style: "solid" }),
									raw({ breakInside: "avoid" }),
								]}
							>
								<h3 mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis")]}>
									{section.title}
								</h3>
								<ul mix={[vstack({ gap: 1.5 }), m(0), p(0), listStyle("none")]}>
									{section.docs.map((doc) => (
										<li key={doc.path}>
											<a
												href={doc.path}
												data-rmx-prefetch="intent"
												mix={[
													text("sm"),
													fg("neutral"),
													hover([fg("brand"), raw({ textDecoration: "underline" })]),
												]}
											>
												{doc.frontmatter.title}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</section>
			</DocsLayout>
		</DocumentLayout>,
	);
});
