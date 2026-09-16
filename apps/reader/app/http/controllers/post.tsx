/**
 * Post controller for `GET /reading/:feed/:item`: one post read here rather than at the
 * publisher. What the feed gave — title, author, date, excerpt and the link — is rendered
 * from the reader's own row and is complete before anything external is asked for, and the
 * article behind the link is folded in underneath it.
 *
 * The cache is consulted while the page is being built, because a hit is one read and
 * waiting on it beats sending a page that immediately replaces itself. A miss leaves a
 * frame in the article's place, resolved the way the timeline resolves the page below it,
 * so a reader has the post the instant they ask for it and the article a moment later.
 *
 * Nothing this page does is written into the reader's object, so every way the fetch can
 * fail is a sentence in place of the article and the excerpt and the link stay exactly
 * where they were.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { flex, flexWrap, gap, items, vstack } from "@sdxc/u/layout";
import { mbs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Empty, HeadingScope, LinkButton, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { Article as Extracted, ArticleOutcome } from "~/app/lib/article";

import { chrome } from "~/app/http/controllers/chrome";
import { exactDate } from "~/app/http/controllers/timeline-entries";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { FRAME_PARAM, isFrameRequest } from "~/app/http/render";
import { peekArticle, readArticle } from "~/app/lib/article";
import { features } from "~/app/lib/flags";
import { userStore } from "~/database/user-do";
import LazyFrame from "~/resources/components/lazy-frame";
import SaveToggle from "~/resources/components/save-toggle";
import AppLayout from "~/resources/layouts/app";
import Article from "~/resources/views/article";
import routes from "~/routes/web";

/** The path this route matches, which carries the feed and the post being read. */
const Params = s.object({ feed: s.string(), item: s.string() });

/** What {@link FRAME_PARAM} carries for the piece holding the article alone. */
const FRAME_ARTICLE = "article";

/**
 * How far ahead of the viewport the article starts arriving. Nothing: the frame sits
 * directly under the post's own excerpt, which is where the reader already is, so it is
 * fetched as the page mounts rather than on the chance of a scroll.
 */
const ARTICLE_REACH = "0px";

/**
 * The Content-Security-Policy the post's page is served under.
 *
 * This is the one page in the app that renders a publisher's markup in this app's origin,
 * on a request carrying the reader's session, so a bug in the sanitizer would be a stored
 * cross-site-scripting hole against everybody who opens that article. The policy is the
 * second line behind the sanitizer: an extracted article may load images over HTTPS and do
 * nothing else, and every script and style the page runs is this app's own.
 *
 * Inline styles are permitted because the renderer collects the page's own rules into
 * `<style>` elements it emits with the document; nothing else here relaxes the default of
 * `'none'`.
 */
const CONTENT_SECURITY_POLICY = [
	"default-src 'none'",
	"img-src https:",
	"style-src 'self' 'unsafe-inline'",
	"script-src 'self'",
	"connect-src 'self'",
	"form-action 'self'",
	"base-uri 'none'",
	"frame-ancestors 'none'",
].join("; ");

/** The sentence an attempt that produced no article is reported in. */
function outcomeCopy(i18next: i18n, outcome: ArticleOutcome): string {
	if (outcome === "refused") return i18next.t("post.article.refused");
	if (outcome === "timeout") return i18next.t("post.article.timeout");
	return i18next.t("post.article.empty");
}

/**
 * The address the article is fetched at as a fragment, which is a different URL from the
 * page itself: the page is somewhere to navigate to, this is a piece to write into it.
 *
 * @param feedId - The subscription the post came from.
 * @param itemId - The post being read.
 */
function articleSrc(feedId: string, itemId: string): string {
	let base = routes.post.href({ feed: feedId, item: itemId });
	return `${base}?${FRAME_PARAM}=${FRAME_ARTICLE}`;
}

/**
 * The article itself, or the one sentence saying why there is none. Both are rendered
 * states and both answer `200`: a site that refused is news about the site, and the post's
 * own excerpt and link are already on the page above this.
 */
function ArticleBody(handle: Handle<{ article: Extracted | null; copy: string; byline: string }>) {
	return () => {
		let { article, byline, copy } = handle.props;

		if (article === null || article.html === null) {
			return <Text mix={[fg("neutral.muted")]}>{copy}</Text>;
		}

		return (
			<div mix={[vstack(), gap(2)]}>
				{article.byline && <Text mix={[text("sm"), fg("neutral.muted")]}>{byline}</Text>}

				<Article html={article.html} />
			</div>
		);
	};
}

/** GET /reading/:feed/:item — one post, and the article behind its link. */
export default createAction(routes.post, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feed: feedId, item: itemId } = s.parse(Params, ctx.params);
		let store = userStore(viewer.id);

		let opened = await store.openPost(itemId);

		/**
		 * A post somebody else holds is as absent here as one nobody does, since the lookup
		 * runs inside this reader's own object and answers for nothing outside it.
		 */
		if (!opened || opened.item.feedId !== feedId) {
			let body = (
				<HeadingScope level={2}>
					<Empty>
						<Empty.Title>{ctx.i18next.t("post.notFound.title")}</Empty.Title>
						<Empty.Description>{ctx.i18next.t("post.notFound.description")}</Empty.Description>
						<Empty.Action>
							<LinkButton href={routes.reading.index.href()} size="sm">
								{ctx.i18next.t("post.notFound.back")}
							</LinkButton>
						</Empty.Action>
					</Empty>
				</HeadingScope>
			);

			if (isFrameRequest(ctx.request)) return ctx.render(body, { status: 404 });

			return ctx.render(
				<AppLayout
					documentTitle={ctx.i18next.t("post.notFound.title")}
					heading={ctx.i18next.t("post.notFound.title")}
					locale={ctx.locale}
					{...await chrome(ctx)}
				>
					{body}
				</AppLayout>,
				{ status: 404 },
			);
		}

		let { feed, fullText, item } = opened;

		/**
		 * Three things have to be true before this app asks a publisher for anything: the
		 * post has an address, the reader's tier carries extraction, and the flag is on. The
		 * flag is the operational switch a tier is not — off, nothing here fetches, for
		 * everybody at once.
		 */
		let mayExtract =
			item.url !== null && fullText && (await ctx.flags.get(features.articleExtraction));

		/**
		 * A frame asked for the article alone, so it is answered with the article alone:
		 * everything else is already in the document this is written into. This is the only
		 * path that reaches a publisher, which is what keeps a timeline, a poll and a
		 * synchronization from extracting anything.
		 */
		if (isFrameRequest(ctx.request)) {
			let article =
				mayExtract && item.url !== null
					? await readArticle({ url: item.url, summary: item.summary })
					: null;

			return ctx.render(
				<ArticleBody
					article={article}
					copy={
						article === null
							? ctx.i18next.t("post.article.empty")
							: outcomeCopy(ctx.i18next, article.outcome)
					}
					byline={ctx.i18next.t("post.article.byline", { byline: article?.byline ?? "" })}
				/>,
			);
		}

		/**
		 * One read, before the page is sent. A hit is the article printed with the post and
		 * no second request; a miss leaves the frame below to go and get it, which is the
		 * only shape that does not make every reader wait on an origin nobody controls.
		 */
		let held = mayExtract && item.url !== null ? await peekArticle(item.url) : null;

		let feedTitle = feed?.title ?? "";

		return ctx.render(
			<AppLayout
				documentTitle={item.title}
				heading={item.title}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<HeadingScope level={2}>
					<div mix={[vstack(), gap(4)]}>
						<div mix={[flex(), flexWrap("wrap"), items("center"), gap(3), text("sm")]}>
							{feed && (
								<a href={routes.feed.href({ feed: feed.id })}>
									{ctx.i18next.t("post.source", { feed: feedTitle })}
								</a>
							)}

							{item.author && (
								<Text mix={[fg("neutral.muted")]}>
									{ctx.i18next.t("timeline.byAuthor", { author: item.author })}
								</Text>
							)}

							<time dateTime={new Date(item.publishedAt).toISOString()} mix={[fg("neutral.muted")]}>
								{exactDate(item.publishedAt, ctx.locale)}
							</time>

							{item.url && (
								<a href={item.url} target="_blank" rel="noopener noreferrer">
									{ctx.i18next.t("post.original")}
								</a>
							)}
						</div>

						{item.summary && <Text mix={[weight("medium")]}>{item.summary}</Text>}

						{/**
						 * What a save actually keeps, said beside the control rather than left for a
						 * reader to find out in two years: the title, the excerpt and the link, and
						 * nothing of the article, which lives only as long as the link does.
						 */}
						<div mix={[flex(), flexWrap("wrap"), items("center"), gap(2)]}>
							<SaveToggle
								action={routes.items.save.href({ itemId: item.id })}
								isSaved={item.savedAt !== null}
								returnTo={ctx.url.pathname}
								save={ctx.i18next.t("timeline.save")}
								unsave={ctx.i18next.t("timeline.unsave")}
								failed={ctx.i18next.t("timeline.saveFailed")}
								full={ctx.i18next.t("timeline.saveFull")}
							/>
							<Text mix={[text("xs"), fg("neutral.muted")]}>{ctx.i18next.t("post.saveKeeps")}</Text>
						</div>

						<section mix={[vstack(), gap(2), mbs(2)]}>
							<h2 mix={[text("lg"), weight("medium")]}>{ctx.i18next.t("post.article.heading")}</h2>

							{!mayExtract && (
								<Text mix={[fg("neutral.muted")]}>
									{fullText
										? ctx.i18next.t("post.article.empty")
										: ctx.i18next.t("post.article.upgrade")}
								</Text>
							)}

							{mayExtract && held !== null && (
								<ArticleBody
									article={held}
									copy={outcomeCopy(ctx.i18next, held.outcome)}
									byline={ctx.i18next.t("post.article.byline", { byline: held.byline ?? "" })}
								/>
							)}

							{mayExtract && held === null && (
								<LazyFrame src={articleSrc(feedId, item.id)} rootMargin={ARTICLE_REACH}>
									<Text mix={[fg("neutral.muted")]}>{ctx.i18next.t("post.article.pending")}</Text>
								</LazyFrame>
							)}
						</section>
					</div>
				</HeadingScope>
			</AppLayout>,
			{ headers: { "content-security-policy": CONTENT_SECURITY_POLICY } },
		);
	},
});
