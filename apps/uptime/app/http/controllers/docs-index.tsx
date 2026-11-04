/**
 * `/docs` is the help centre's front door: it opens on a question with a search field,
 * offers the first tasks a new team takes in order, then every section with what it
 * covers and the guides readers open most, so nobody has to read the sidebar to start.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";

import { raw } from "@sdxc/u/general";
import { DocsHub } from "@sdxc/ui/docs";
import { createAction } from "remix/router";

import type { DocSection } from "~/app/services/docs";
import type { MockupArea } from "~/resources/components/marketing/product-mockups";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/initializers/seo";
import { findDoc, listDocs } from "~/app/services/docs";
import DocsSearchForm from "~/resources/components/docs-search-form";
import ProductMockup from "~/resources/components/marketing/product-mockups";
import DocsLayout, { buildDocsLabels } from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The first tasks a new team takes, in the order they take them. */
const START_PATHS = [
	"/docs/quickstart",
	"/docs/guides/add-a-monitor",
	"/docs/guides/choose-who-gets-alerted",
	"/docs/guides/publish-a-status-page",
	"/docs/team/invites",
];

/** The guides readers open most, each with the screen it walks through. */
const POPULAR: ReadonlyArray<{ path: string; area: MockupArea }> = [
	{ path: "/docs/guides/monitor-a-cron-job", area: "cron" },
	{ path: "/docs/guides/check-a-sign-in-flow", area: "flow" },
	{ path: "/docs/guides/schedule-maintenance", area: "maintenance" },
];

/** Each section's one-line summary, keyed by the title its docs file it under. */
function sectionDescriptions(t: Translate): Readonly<Record<string, string>> {
	return {
		"Getting Started": t("docs.hub.sections.gettingStarted"),
		Guides: t("docs.hub.sections.guides"),
		"Fix a problem": t("docs.hub.sections.troubleshooting"),
		Concepts: t("docs.hub.sections.concepts"),
		"Team & Settings": t("docs.hub.sections.team"),
		"API Reference": t("docs.hub.sections.api"),
		"API Resources": t("docs.hub.sections.apiResources"),
	};
}

/** The topic chips under the search field: the areas most questions are about. */
function topics(t: Translate): Array<{ title: string; href: string }> {
	return [
		{ title: t("docs.hub.topics.monitors"), href: "/docs/concepts/monitors" },
		{ title: t("docs.hub.topics.alerts"), href: "/docs/concepts/alerts" },
		{ title: t("docs.hub.topics.statusPages"), href: "/docs/concepts/status-pages" },
		{
			title: t("docs.hub.topics.troubleshooting"),
			href: "/docs/troubleshooting/not-receiving-alerts",
		},
		{ title: t("docs.hub.topics.api"), href: "/docs/api/overview" },
	];
}

/** A section's card links to its first page, so the card opens the section where it starts. */
function sectionHref(section: DocSection): string {
	return section.docs[0]?.path ?? routes.docs.index.href();
}

/** GET /docs — the documentation hub. */
export default createAction(routes.docs.index, async (ctx) => {
	let t = ctx.intl.t;
	let sections = await listDocs();
	let descriptions = sectionDescriptions(t);
	let start = START_PATHS.flatMap((path) => findDoc(sections, path) ?? []);
	let popular = POPULAR.flatMap(({ path, area }) => {
		let doc = findDoc(sections, path);
		return doc ? [{ doc, area }] : [];
	});

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={t("docs.meta.title")}
			locale={ctx.locale}
			seo={{
				description: t("docs.meta.description"),
				canonical: SEO.canonical(ctx.url),
				schema: SEO.schema.webPage({
					name: t("docs.hub.title"),
					description: t("docs.meta.description"),
					url: ctx.url.href,
					inLanguage: ctx.locale,
				}),
			}}
		>
			<DocsLayout
				isSignedIn={getViewer() !== null}
				chrome={buildMarketingChrome(t)}
				sections={sections}
				activePath={routes.docs.index.href()}
				labels={buildDocsLabels(t)}
			>
				<DocsHub
					eyebrow={t("docs.hub.eyebrow")}
					title={t("docs.hub.title")}
					lead={t("docs.hub.description")}
					search={
						<DocsSearchForm
							label={t("docs.search.label")}
							placeholder={t("docs.search.placeholder")}
							submit={t("docs.search.submit")}
						/>
					}
					topics={topics(t)}
					start={start.map((doc, index) => ({
						title: doc.frontmatter.title,
						href: doc.path,
						description: doc.frontmatter.description,
						eyebrow: t("docs.hub.step", { number: index + 1 }),
					}))}
					sections={sections.map((section) => ({
						title: section.title,
						href: sectionHref(section),
						description: descriptions[section.title] ?? "",
						count: section.docs.length,
					}))}
					formatCount={(count) => t("docs.hub.count", { count })}
					popular={popular.map(({ doc, area }) => ({
						title: doc.frontmatter.title,
						href: doc.path,
						image: (
							<div aria-hidden="true" inert mix={[raw({ pointerEvents: "none" })]}>
								<ProductMockup area={area} t={t} />
							</div>
						),
					}))}
					labels={{
						start: t("docs.hub.start"),
						sections: t("docs.hub.sectionsTitle"),
						topics: t("docs.hub.topicsTitle"),
						popular: t("docs.hub.popular"),
					}}
				/>
			</DocsLayout>
		</DocumentLayout>,
	);
});
