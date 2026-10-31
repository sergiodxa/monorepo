/**
 * `/docs/search?q=` answers a reader's question from every page's body, best answers first,
 * each labelled by kind and linked to the section that matched. With no match, or no
 * question yet, it offers the pages most readers want and a way to reach a person.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";

import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Badge, DocsPageHeader, Highlight, NextSteps } from "@sdxc/ui";
import { createAction } from "remix/router";

import type { DocKind } from "~/app/services/docs";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/initializers/seo";
import { findDoc, listDocs } from "~/app/services/docs";
import { searchDocs } from "~/app/services/docs-search";
import DocsSearchForm from "~/resources/components/docs-search-form";
import DocsLayout, { buildDocsLabels, supportHref } from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The pages offered before a question and after one finds nothing, in this order. */
const POPULAR_PATHS = [
	"/docs/quickstart",
	"/docs/guides/add-a-monitor",
	"/docs/guides/choose-who-gets-alerted",
	"/docs/guides/publish-a-status-page",
	"/docs/troubleshooting/not-receiving-alerts",
	"/docs/troubleshooting/alerts-but-site-is-up",
];

/** The longest question searched; anything past it is a paste, not a question. */
const MAX_QUERY_LENGTH = 200;

/** Each kind's translated badge. */
function kindLabels(t: Translate): Record<DocKind, string> {
	return {
		guide: t("docs.search.kinds.guide"),
		troubleshooting: t("docs.search.kinds.troubleshooting"),
		concept: t("docs.search.kinds.concept"),
		reference: t("docs.search.kinds.reference"),
	};
}

/** GET /docs/search — the results page, kept out of search engines' indexes. */
export default createAction(routes.docs.search, async (ctx) => {
	let t = ctx.intl.t;
	let query = (ctx.url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
	let sections = await listDocs();
	let { results } = await searchDocs(query);
	let popular = POPULAR_PATHS.flatMap((path) => findDoc(sections, path) ?? []);
	let kinds = kindLabels(t);
	let asked = query !== "";

	ctx.log.set({ docs_search: { query, results: results.length } });

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${t("docs.search.title")} | ${t("docs.meta.title")}`}
			locale={ctx.locale}
			seo={{
				canonical: SEO.canonical(ctx.url),
				robots: SEO.robotsTag({ index: false, follow: true }),
			}}
		>
			<DocsLayout
				isSignedIn={getViewer() !== null}
				chrome={buildMarketingChrome(t)}
				sections={sections}
				activePath={routes.docs.search.href()}
				labels={buildDocsLabels(t)}
			>
				<DocsPageHeader
					crumbsLabel={t("app.layout.breadcrumbs.label")}
					crumbs={[
						{ label: t("docs.shell.root"), href: routes.docs.index.href() },
						{ label: t("docs.search.title") },
					]}
					title={asked ? t("docs.search.resultsFor", { query }) : t("docs.search.title")}
				/>

				<DocsSearchForm
					label={t("docs.search.label")}
					placeholder={t("docs.search.placeholder")}
					submit={t("docs.search.submit")}
					query={query}
				/>

				{results.length > 0 ? (
					<ol
						aria-label={t("docs.search.results")}
						mix={[vstack({ gap: 3 }), m("2rem", 0, 0, 0), p(0), listStyle("none")]}
					>
						{results.map((result) => (
							<li key={result.href}>
								<a
									href={result.href}
									mix={[
										vstack({ gap: 1.5 }),
										p(4),
										rounded("lg"),
										border({ color: "neutral.border", width: 1, style: "solid" }),
										raw({ textDecoration: "none" }),
										hover(border({ color: "brand.border", width: 1, style: "solid" })),
										focusVisible(
											raw({ outline: "2px solid var(--ui-brand-solid)", outlineOffset: "2px" }),
										),
									]}
								>
									<span mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
										<Badge
											variant="secondary"
											color={result.kind === "troubleshooting" ? "warning" : "neutral"}
										>
											{kinds[result.kind]}
										</Badge>
										<span mix={[text("base"), weight("semibold"), fg("neutral.emphasis")]}>
											<Highlight segments={result.title} />
										</span>
									</span>
									{result.section ? (
										<span mix={[text("sm"), weight("medium"), fg("neutral")]}>
											{result.section}
										</span>
									) : null}
									<span mix={[text("sm"), fg("neutral.muted"), raw({ lineHeight: 1.6 })]}>
										<Highlight segments={result.snippet} />
									</span>
								</a>
							</li>
						))}
					</ol>
				) : null}

				{asked && results.length === 0 ? (
					<div role="status" mix={[vstack({ gap: 2 }), m("2rem", 0, 0, 0)]}>
						<p mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis")]}>
							{t("docs.search.empty", { query })}
						</p>
						<p mix={[m(0), text("sm"), fg("neutral")]}>{t("docs.search.emptyHint")}</p>
					</div>
				) : null}

				{results.length === 0 ? (
					<NextSteps
						title={t("docs.search.popular")}
						id="popular"
						items={popular.map((doc) => ({
							title: doc.frontmatter.title,
							href: doc.path,
							description: doc.frontmatter.description,
						}))}
					/>
				) : null}

				<p mix={[m("2.5rem", 0, 0, 0), text("sm"), fg("neutral")]}>
					{t("docs.search.contact")}{" "}
					<a href={supportHref(routes.docs.search.href())} mix={[fg("brand"), weight("medium")]}>
						{t("docs.questions.link")}
					</a>
				</p>
			</DocsLayout>
		</DocumentLayout>,
	);
});
