/**
 * The help hub at `/docs`. It routes rather than explains: where a new reader starts, the
 * questions people arrive with, and every section with a line on what it covers, all
 * read from the one registry the sidebar draws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DocsHub } from "@sdxc/ui/docs";
import { createAction } from "remix/router";

import { isAuthenticated } from "~/app/http/middleware/auth";
import { SEO } from "~/app/initializers/seo";
import { landingTranslate } from "~/resources/components/marketing/figures";
import {
	DOC_PAGES,
	DOC_SECTIONS,
	docHref,
	pageLink,
	pageTitle,
	sectionDescription,
	sectionTitle,
} from "~/resources/docs/registry";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The first pages a new reader needs, drawn larger than the rest. */
const START_SLUGS = ["getting-started", "import-opml"];

/** The questions people arrive with most, as chips under the title. */
const TOPIC_SLUGS = [
	"reading",
	"search",
	"folders",
	"notifications",
	"plans",
	"export",
	"feed-not-updating",
];

export default createAction(routes.docs.index, (ctx) => {
	let t = landingTranslate(ctx.intl, ctx.locale);
	let path = routes.docs.index.href();

	let start = START_SLUGS.map((slug) => pageLink(t, slug));

	let topics = TOPIC_SLUGS.map((slug) => ({ title: pageTitle(t, slug), href: docHref(slug) }));

	let sections = DOC_SECTIONS.flatMap((key) => {
		let pages = DOC_PAGES.filter((page) => page.section === key);
		let first = pages[0];
		if (!first) return [];
		return [
			{
				title: sectionTitle(t, key),
				href: docHref(first.slug),
				description: sectionDescription(t, key),
				count: pages.length,
			},
		];
	});

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={t("docs.title")}
			description={t("docs.hub.lead")}
			locale={ctx.locale}
			seo={{
				canonical: SEO.canonical(path),
				schema: SEO.schema.webPage({
					name: t("docs.hub.title"),
					description: t("docs.hub.lead"),
					url: path,
					inLanguage: ctx.locale,
				}),
			}}
		>
			<DocsLayout t={t} isSignedIn={isAuthenticated()} activePath={path}>
				<DocsHub
					eyebrow={t("docs.eyebrow")}
					title={t("docs.hub.title")}
					lead={t("docs.hub.lead")}
					start={start}
					topics={topics}
					sections={sections}
					labels={{
						start: t("docs.hub.start"),
						sections: t("docs.hub.sections"),
						topics: t("docs.hub.topics"),
					}}
					formatCount={(count) => t("docs.hub.guides", { count })}
				/>
			</DocsLayout>
		</DocumentLayout>,
	);
});
