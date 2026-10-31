/**
 * One help page: its header with the plan it needs, the body its module draws, a route
 * to a person, a hand-picked "Up next", and the helpfulness vote. An unknown slug answers
 * 404 with the docs' own not-found page, which suggests where to go instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n, Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { Trans } from "@sdxc/i18n/ui";
import { raw } from "@sdxc/u/general";
import { Callout, DocsFeedback, DocsPageHeader, NextSteps, PlanNotice } from "@sdxc/ui";
import { DocsNotFound, searchQueryFromPath } from "@sdxc/ui/patterns";
import { createAction } from "remix/router";

import type { DocPage } from "~/resources/docs/registry";

import { SUPPORT_FROM_PARAM } from "~/app/http/controllers/support";
import { isAuthenticated } from "~/app/http/middleware/auth";
import { landingTranslate } from "~/resources/components/marketing/figures";
import { docsFigures } from "~/resources/docs/figures";
import {
	docHref,
	findDocPage,
	loadDocBody,
	pageDescription,
	pageLink,
	pageTitle,
	sectionTitle,
} from "~/resources/docs/registry";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The query a vote redirects back with, so the page thanks the reader in place of the form. */
export const FEEDBACK_SENT_PARAM = "feedback";

/** The pages a 404 offers, which are the ones people arrive at docs looking for. */
const NOT_FOUND_SLUGS = ["getting-started", "import-opml", "plans", "feed-not-updating"];

export default createAction(routes.docs.show, async (ctx) => {
	let t = landingTranslate(ctx.intl, ctx.locale);
	let isSignedIn = isAuthenticated();
	let page = findDocPage(ctx.params.slug ?? "");

	if (!page) {
		let links = NOT_FOUND_SLUGS.map((slug) => pageLink(t, slug));
		let query = searchQueryFromPath(ctx.url.pathname);

		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={t("docs.notFound.title")} locale={ctx.locale}>
				<DocsLayout t={t} isSignedIn={isSignedIn} activePath={ctx.url.pathname}>
					<DocsNotFound
						path={query}
						links={links}
						labels={{
							eyebrow: t("docs.notFound.eyebrow"),
							title: t("docs.notFound.title"),
							body: t("docs.notFound.body"),
							linksTitle: t("docs.notFound.links"),
						}}
					/>
				</DocsLayout>
			</DocumentLayout>,
			{ status: 404 },
		);
	}

	let module = await loadDocBody(page.slug, ctx.locale);
	let title = pageTitle(t, page.slug);
	let description = pageDescription(t, page.slug);
	let Body = module.default;
	let path = docHref(page.slug);
	let sent = ctx.url.searchParams.get(FEEDBACK_SENT_PARAM) === "sent";

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${title} · ${t("docs.title")}`}
			description={description}
			locale={ctx.locale}
		>
			<DocsLayout t={t} isSignedIn={isSignedIn} activePath={path} toc={module.TOC}>
				<DocsPageHeader
					crumbsLabel={t("docs.nav.crumbs")}
					crumbs={[
						{ label: t("docs.eyebrow"), href: routes.docs.index.href() },
						{ label: sectionTitle(t, page.section) },
						{ label: title },
					]}
					title={title}
					description={description}
					notice={page.plan ? <PlanRequirement intl={ctx.intl} plan={page.plan} /> : undefined}
					mix={[raw({ marginBlockEnd: "2rem" })]}
				/>

				<Body t={t} figures={docsFigures(ctx.locale)} locale={ctx.locale} />

				<PageEnd t={t} intl={ctx.intl} page={page} path={path} sent={sent} />
			</DocsLayout>
		</DocumentLayout>,
	);
});

/** The support form, told which help page the reader was on when they gave up. */
function supportHref(slug: string): string {
	return `${routes.support.index.href()}?${new URLSearchParams({ [SUPPORT_FROM_PARAM]: slug })}`;
}

/** The fixed sentence under a gated page's title, its plan names linked to the plan table. */
function PlanRequirement(handle: Handle<{ intl: I18n; plan: "paid" | "premium" }>) {
	return () => (
		<PlanNotice>
			<Trans
				intl={handle.props.intl}
				i18nKey={`docs.page.${handle.props.plan}`}
				components={{ link: <a href={docHref("plans")}>{""}</a> }}
			/>
		</PlanNotice>
	);
}

namespace PageEnd {
	export interface Props {
		t: Translate;
		intl: I18n;
		page: DocPage;
		path: string;
		/** Whether the reader just voted, which swaps the form for its thanks. */
		sent: boolean;
	}
}

/**
 * Where every help page ends: a person to write to, the hand-picked pages that follow from
 * this one, then the vote, so the last thing on the page is a way forward.
 */
function PageEnd(handle: Handle<PageEnd.Props>) {
	return () => {
		let { intl, page, path, sent, t } = handle.props;
		let next = page.next.filter((slug) => findDocPage(slug)).map((slug) => pageLink(t, slug));

		return (
			<div
				data-slot="docs-page-end"
				mix={[raw({ display: "grid", gap: "2.5rem", marginBlockStart: "3.5rem" })]}
			>
				<Callout kind="note" label={t("docs.page.stuck.title")}>
					<p>
						<Trans
							intl={intl}
							i18nKey="docs.page.stuck.body"
							components={{ link: <a href={supportHref(page.slug)}>{""}</a> }}
						/>
					</p>
				</Callout>

				{next.length > 0 ? (
					<NextSteps id="up-next" level={2} title={t("docs.page.next")} items={next} />
				) : null}

				<DocsFeedback
					id="docs-feedback"
					action={routes.docs.feedback.href()}
					page={path}
					state={sent ? "sent" : "idle"}
					labels={{
						question: t("docs.feedback.question"),
						yes: t("docs.feedback.yes"),
						no: t("docs.feedback.no"),
						note: t("docs.feedback.note"),
						send: t("docs.feedback.send"),
						thanks: t("docs.feedback.thanks"),
					}}
				/>
			</div>
		);
	};
}
